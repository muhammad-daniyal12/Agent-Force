import { withOwner, unsupported } from "@/lib/server/http";
import { listQuotations } from "@/lib/server/quotations";
import { queryParams, quotationStatus } from "@/lib/server/validation";
export function GET(request: Request) {
  return withOwner(request, (store) => {
    const status = queryParams(request, ["status"]).get("status");
    return listQuotations(
      store,
      status === null ? undefined : quotationStatus.parse(status),
    );
  });
}
const other = () => unsupported(["GET"]);
export {
  other as POST,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
