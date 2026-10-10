import { withOwner, unsupported } from "@/lib/server/http";
import { followUpQuotation } from "@/lib/server/quotations";
import { resourceId } from "@/lib/server/validation";

type Context = { params: Promise<{ id: string }> };

export function POST(request: Request, context: Context) {
  return withOwner(request, async (store) =>
    followUpQuotation(store, resourceId.parse((await context.params).id)),
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
