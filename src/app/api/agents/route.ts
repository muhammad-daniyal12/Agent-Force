import { withOwner, unsupported } from "@/lib/server/http";
import { agents } from "@/lib/server/dashboard";
import { queryParams } from "@/lib/server/validation";
export function GET(request: Request) {
  return withOwner(request, (store) => {
    queryParams(request, []);
    return agents(store);
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
