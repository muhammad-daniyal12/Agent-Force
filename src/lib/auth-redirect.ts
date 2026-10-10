// Shared redirect validation; contains no server configuration or credentials.
export function safeAuthRedirect(value: string | null | undefined): string {
  if (!value) return "/";
  if (
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20\x7f]/.test(value)
  )
    return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\x00-\x20\x7f]/.test(decoded))
      return "/";
    const url = new URL(value, "https://auth.invalid");
    if (
      url.origin !== "https://auth.invalid" ||
      url.pathname.startsWith("//") ||
      /^\/(?:login|signup|api)(?:\/|$)/.test(decodeURIComponent(url.pathname))
    )
      return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
