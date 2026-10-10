import { googleCallback } from "@/lib/server/oauth";
import { unsupported } from "@/lib/server/http";
export const GET = googleCallback;
const other = () => unsupported(["GET"]);
export {
  other as POST,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
