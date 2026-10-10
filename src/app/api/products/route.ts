import { z } from "zod";
import { withOwner, unsupported } from "@/lib/server/http";
import { listProducts, createProduct } from "@/lib/server/products";
import { productInput, queryParams, readJson } from "@/lib/server/validation";
export function GET(request: Request) {
  return withOwner(request, (store) => {
    const q = queryParams(request, ["q"]);
    return listProducts(
      store,
      z
        .string()
        .max(100)
        .parse(q.get("q") ?? ""),
    );
  });
}
export function POST(request: Request) {
  return withOwner(
    request,
    async (store) =>
      createProduct(store, await readJson(request, productInput)),
    201,
  );
}
const other = () => unsupported(["GET", "POST"]);
export { other as PUT, other as PATCH, other as DELETE, other as OPTIONS };
