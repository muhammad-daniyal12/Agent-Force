// Server wrapper: the screen is a client component that renders after the session check,
// so opt out of instant-navigation prerender validation (dev-only).
import Screen from "./client";

export const instant = false;

export default Screen;
