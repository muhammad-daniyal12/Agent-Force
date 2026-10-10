import { withOwner, unsupported } from "@/lib/server/http";
import { updateProduct, deleteProduct } from "@/lib/server/products";
import { productPatch, readJson, resourceId } from "@/lib/server/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export function PATCH(request: Request, context: Context) { return withOwner(request, async store => updateProduct(store, resourceId.parse((await context.params).id), await readJson(request, productPatch))); }
export function DELETE(request: Request, context: Context) { return withOwner(request, async store => deleteProduct(store, resourceId.parse((await context.params).id))); }
const other = () => unsupported(["PATCH", "DELETE"]);
export { other as GET, other as POST, other as PUT, other as OPTIONS };

