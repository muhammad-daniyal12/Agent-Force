import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { interpretRequest } from "../llm";

const originalFetch = globalThis.fetch;
beforeEach(() => {
  Object.assign(process.env, {
    LLM_PROVIDER: "openai",
    OPENAI_API_KEY: "dummy-test-key",
    OPENAI_MODEL: "test-model",
    ANTHROPIC_API_KEY: "dummy-test-key",
    ANTHROPIC_MODEL: "test-model",
    GEMINI_API_KEY: "dummy-test-key",
    GEMINI_MODEL: "test-model",
    LLM_TIMEOUT_MS: "100",
  });
  delete process.env.LLM_MODEL;
  delete process.env.LLM_BASE_URL;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const interpretation = {
  intent: "quote",
  items: [{ productQuery: "wireless mouse", quantity: 10 }],
  urgency: "normal",
  sentiment: "neutral",
};

test("no provider key uses fallback without making a network call", async () => {
  process.env.OPENAI_API_KEY = "";
  globalThis.fetch = async () => {
    throw new Error("Network should not be called.");
  };
  const result = await interpretRequest(
    "I need 10 wireless mice",
    [],
    Date.now() + 24000,
  );
  assert.equal(result.fallback, true);
  assert.equal(result.interpretation.items[0].quantity, 10);
});

test("OpenAI extraction uses a strict, single function with no business mutation tools", async () => {
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /api\.openai\.com\/v1\/responses$/);
    const sent = JSON.parse(String(init?.body));
    assert.equal(sent.store, false);
    assert.equal(sent.tools.length, 1);
    assert.equal(sent.tools[0].name, "extract_request");
    assert.equal(sent.tools[0].strict, true);
    assert.equal(sent.tools[0].parameters.additionalProperties, false);
    return Response.json({
      output: [
        {
          type: "function_call",
          name: "extract_request",
          arguments: JSON.stringify(interpretation),
        },
      ],
    });
  };
  assert.equal(
    (await interpretRequest("I need mice", [], Date.now() + 24000)).fallback,
    false,
  );
});

test("Anthropic extraction uses tool input and validates its structure", async () => {
  process.env.LLM_PROVIDER = "anthropic";
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /api\.anthropic\.com\/v1\/messages$/);
    assert.equal(
      JSON.parse(String(init?.body)).tool_choice.name,
      "extract_request",
    );
    return Response.json({
      content: [
        { type: "tool_use", name: "extract_request", input: interpretation },
      ],
    });
  };
  assert.equal(
    (await interpretRequest("I need mice", [], Date.now() + 24000)).fallback,
    false,
  );
});

test("provider failure, malformed output, and unauthorized intents use fallback", async () => {
  for (const response of [
    () => new Response("provider error", { status: 500 }),
    () => Response.json({ output: [] }),
    () =>
      Response.json({
        output: [
          {
            type: "function_call",
            name: "extract_request",
            arguments: JSON.stringify({
              ...interpretation,
              intent: "approve",
              owner_user_id: "other",
            }),
          },
        ],
      }),
  ]) {
    globalThis.fetch = async () => response();
    const result = await interpretRequest(
      "I need 10 wireless mice",
      [],
      Date.now() + 24000,
    );
    assert.equal(result.fallback, true);
    assert.equal(result.interpretation.intent, "quote");
  }
});

test("a stalled provider is aborted within its bounded timeout and falls back", async () => {
  globalThis.fetch = async (_input, init) =>
    new Promise((_resolve, reject) =>
      init!.signal!.addEventListener(
        "abort",
        () => reject(new Error("Aborted")),
        { once: true },
      ),
    );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await interpretRequest(
      "I need 10 wireless mice",
      [],
      Date.now() + 24000,
    );
    assert.equal(result.fallback, true);
  } finally {
    clearTimeout(keepAlive);
  }
});

test("Gemini official SDK forces only extraction and excludes private catalog fields", async () => {
  process.env.LLM_PROVIDER = "gemini";
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.match(
      input instanceof Request ? input.url : String(input),
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/test-model:generateContent$/,
    );
    const sent =
      input instanceof Request
        ? await input.json()
        : JSON.parse(String(init?.body));
    assert.equal(sent.tools.length, 1);
    assert.equal(sent.tools[0].functionDeclarations.length, 1);
    assert.equal(sent.tools[0].functionDeclarations[0].name, "extract_request");
    assert.equal(
      sent.tools[0].functionDeclarations[0].parametersJsonSchema
        .additionalProperties,
      false,
    );
    assert.deepEqual(sent.toolConfig.functionCallingConfig, {
      mode: "ANY",
      allowedFunctionNames: ["extract_request"],
    });
    const catalog = JSON.parse(sent.contents[0].parts[0].text).catalog[0];
    assert.deepEqual(Object.keys(catalog).sort(), ["category", "name", "sku"]);
    return Response.json({
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                functionCall: { name: "extract_request", args: interpretation },
              },
            ],
          },
        },
      ],
    });
  };
  const result = await interpretRequest(
    "I need 10 wireless mice",
    [
      {
        id: "private-product-id",
        sku: "MOUSE-1",
        name: "Wireless Mouse",
        category: "Mice",
        price: 29.99,
        stock: 120,
        lowStockThreshold: 10,
        updatedAt: "2026-01-01",
      },
    ],
    Date.now() + 24000,
  );
  assert.equal(result.fallback, false);
  assert.deepEqual(result.interpretation, interpretation);
  assert.equal(calls, 1);
});

test("Gemini errors do not retry and expose only sanitized failure metadata", async () => {
  process.env.LLM_PROVIDER = "gemini";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      { error: { code: 429, message: "private-provider-details" } },
      { status: 429 },
    );
  };
  const result = await interpretRequest(
    "I need 10 wireless mice",
    [],
    Date.now() + 24000,
  );
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, "provider_error");
  assert.equal(result.providerStatus, 429);
  assert.equal(calls, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-provider-details|dummy-test-key/,
  );
});

test("Gemini invalid, multiple, or privileged tool calls are rejected", async () => {
  process.env.LLM_PROVIDER = "gemini";
  for (const calls of [
    [],
    [{ name: "approve", args: interpretation }],
    [
      {
        name: "extract_request",
        args: { ...interpretation, owner_user_id: "other" },
      },
    ],
    [1, 2].map(() => ({ name: "extract_request", args: interpretation })),
  ]) {
    globalThis.fetch = async () =>
      Response.json({
        candidates: [
          {
            content: {
              role: "model",
              parts: calls.map((functionCall) => ({ functionCall })),
            },
          },
        ],
      });
    const result = await interpretRequest(
      "I need 10 wireless mice",
      [],
      Date.now() + 24000,
    );
    assert.equal(result.fallback, true);
    assert.equal(result.fallbackReason, "invalid_output");
  }
});

test("Gemini missing key makes no call, and a stalled SDK call respects timeout", async () => {
  process.env.LLM_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "";
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    return new Promise((_resolve, reject) => {
      const signal = _input instanceof Request ? _input.signal : init!.signal!;
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };
  assert.equal(
    (await interpretRequest("I need mice", [], Date.now() + 24000))
      .fallbackReason,
    "missing_configuration",
  );
  assert.equal(calls, 0);
  process.env.GEMINI_API_KEY = "dummy-test-key";
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    assert.equal(
      (await interpretRequest("I need mice", [], Date.now() + 24000)).fallback,
      true,
    );
    assert.equal(calls, 1);
  } finally {
    clearTimeout(keepAlive);
  }
});
