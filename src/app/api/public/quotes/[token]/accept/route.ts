import { unsupported } from "@/lib/server/http";
import { handlePublicQuote } from "@/lib/server/public-quotes";

type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  return handlePublicQuote(request, (await context.params).token, "POST");
}
const other = () => unsupported(["POST"]);
export { other as GET, other as PUT, other as PATCH, other as DELETE, other as OPTIONS };
