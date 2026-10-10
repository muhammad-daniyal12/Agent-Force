import { z } from "zod";
import { withOwner, unsupported } from "@/lib/server/http";
import { runOperation } from "@/lib/server/agents/orchestrator";
import { operationInput, readJson } from "@/lib/server/validation";
export function POST(request: Request) {
  return withOwner(request, async (store) => {
    const body = await readJson(request, operationInput);
    const rawKey = request.headers.get("idempotency-key");
    const key =
      rawKey === null
        ? undefined
        : z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,128}$/)
            .parse(rawKey);
    return runOperation(store, body, key);
  });
}
const other = () => unsupported(["POST"]);
export {
  other as GET,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
