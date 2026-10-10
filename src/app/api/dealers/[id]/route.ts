import { withOwner, unsupported } from "@/lib/server/http";
import { deleteDealer, dealerPatch, updateDealer } from "@/lib/server/dealers";
import { readJson, resourceId } from "@/lib/server/validation";

type Context = { params: Promise<{ id: string }> };
export function PATCH(request: Request, context: Context) {
  return withOwner(request, async (store) =>
    updateDealer(
      store,
      resourceId.parse((await context.params).id),
      await readJson(request, dealerPatch),
    ),
  );
}
export function DELETE(request: Request, context: Context) {
  return withOwner(request, async (store) =>
    deleteDealer(store, resourceId.parse((await context.params).id)),
  );
}
const other = () => unsupported(["PATCH", "DELETE"]);
export { other as GET, other as POST, other as PUT, other as OPTIONS };
