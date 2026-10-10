import { withOwner, unsupported } from "@/lib/server/http";
import { createDealer, dealerInput, listDealers } from "@/lib/server/dealers";
import { readJson } from "@/lib/server/validation";

export function GET(request: Request) {
  return withOwner(request, (store) => listDealers(store));
}
export function POST(request: Request) {
  return withOwner(
    request,
    async (store) => createDealer(store, await readJson(request, dealerInput)),
    201,
  );
}
const other = () => unsupported(["GET", "POST"]);
export { other as PUT, other as PATCH, other as DELETE, other as OPTIONS };
