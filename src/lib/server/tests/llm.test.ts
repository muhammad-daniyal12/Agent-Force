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
