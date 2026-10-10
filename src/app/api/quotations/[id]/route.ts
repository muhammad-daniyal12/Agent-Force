import { withOwner, unsupported } from "@/lib/server/http";
import { quoteDto } from "@/lib/server/mappers";
import { resourceId } from "@/lib/server/validation";
export const runtime = "nodejs";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) { return withOwner(request, async store => quoteDto(await store.get("quotations", resourceId.parse((await context.params).id)))); }
const other = () => unsupported(["GET"]);
export { other as POST, other as PUT, other as PATCH, other as DELETE, other as OPTIONS };

