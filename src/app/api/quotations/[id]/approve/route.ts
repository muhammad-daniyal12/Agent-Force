import { withOwner, unsupported } from "@/lib/server/http";
import { reviewQuotation } from "@/lib/server/quotations";
import { decisionInput, readJson, resourceId } from "@/lib/server/validation";
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withOwner(request, async (store) => {
    const id = resourceId.parse((await context.params).id);
    const body = await readJson(request, decisionInput);
    return reviewQuotation(store, id, "approved", body.note);
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
