import { json, requireOwner, respond, unsupported } from "@/lib/server/http";
export const runtime = "nodejs";
export function GET(request: Request) { return respond(async () => { const user = await requireOwner(request); return json({ data: { user: { id: user.$id, name: user.name, email: user.email } } }); }); }
const other = () => unsupported(["GET"]);
export { other as POST, other as PUT, other as PATCH, other as DELETE, other as OPTIONS };

