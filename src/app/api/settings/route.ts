import { withOwner, unsupported } from "@/lib/server/http";
import { readSettings, settingsInput, writeSettings } from "@/lib/server/settings";
import { readJson } from "@/lib/server/validation";

export function GET(request: Request) {
  return withOwner(request, (store, owner) => readSettings(store, owner.name));
}

export function PUT(request: Request) {
  return withOwner(request, async (store) =>
    writeSettings(store, await readJson(request, settingsInput)),
  );
}

const other = () => unsupported(["GET", "PUT"]);
export { other as POST, other as PATCH, other as DELETE, other as OPTIONS };
