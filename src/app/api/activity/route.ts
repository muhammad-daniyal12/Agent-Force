import { z } from "zod";
import { withOwner, unsupported } from "@/lib/server/http";
import { activityDto } from "@/lib/server/mappers";
import { queryParams } from "@/lib/server/validation";
export function GET(request: Request) {
  return withOwner(request, async (store) => {
    const query = queryParams(request, ["limit"]);
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(query.get("limit") ?? 20);
    return (await store.latest("activity", limit)).map(activityDto);
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
