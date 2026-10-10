import { startGoogle } from "@/lib/server/oauth";
import { unsupported } from "@/lib/server/http";
export const POST = startGoogle;
const other = () => unsupported(["POST"]);
export {
  other as GET,
  other as PUT,
  other as PATCH,
  other as DELETE,
  other as OPTIONS,
};
