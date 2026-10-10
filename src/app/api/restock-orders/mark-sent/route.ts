import { withOwner, unsupported } from "@/lib/server/http";
import { markRestockSent, markSentInput } from "@/lib/server/restock-orders";
import { readJson } from "@/lib/server/validation";

export function POST(request: Request) {
  return withOwner(request, async (store) =>
    markRestockSent(store, await readJson(request, markSentInput)),
  );
}
const other = () => unsupported(["POST"]);
export {
  other as GET,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
