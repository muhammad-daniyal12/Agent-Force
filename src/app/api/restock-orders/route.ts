import { withOwner, unsupported } from "@/lib/server/http";
import { listRestockOrders, restockSince, restockStatus } from "@/lib/server/restock-orders";
import { queryParams } from "@/lib/server/validation";

export function GET(request: Request) {
  return withOwner(request, (store) => {
    const params = queryParams(request, ["status", "since"]);
    const status = params.get("status");
    const since = params.get("since");
    return listRestockOrders(
      store,
      status === null ? undefined : restockStatus.parse(status),
      since === null ? undefined : restockSince.parse(since),
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
