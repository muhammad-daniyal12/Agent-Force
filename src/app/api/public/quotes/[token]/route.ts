import { unsupported } from "@/lib/server/http";
import { handlePublicQuote } from "@/lib/server/public-quotes";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: Context) {
  return handlePublicQuote(request, (await context.params).token, "GET");
}
const other = () => unsupported(["GET"]);
export { other as POST, other as PUT, other as PATCH, other as DELETE, other as OPTIONS };
