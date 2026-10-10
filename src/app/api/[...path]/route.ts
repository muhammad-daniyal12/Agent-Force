import { json, respond } from "@/lib/server/http";
const notFound = () =>
  respond(async () => json({ error: "API endpoint not found." }, 404));
export {
  notFound as GET,
  notFound as POST,
  notFound as PUT,
  notFound as PATCH,
  notFound as DELETE,
  notFound as OPTIONS,
};
