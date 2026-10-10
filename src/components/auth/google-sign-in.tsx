"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { isMockMode } from "@/lib/api/client";

export function GoogleSignIn({
  next = "/",
  disabled = false,
}: {
  next?: string;
  disabled?: boolean;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <form
      action="/api/auth/google/start"
      method="post"
      onSubmit={() => setLeaving(true)}
    >
      <input type="hidden" name="next" value={safeAuthRedirect(next)} />
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        className="h-11 w-full gap-3 rounded-xl"
        disabled={disabled || isMockMode}
        loading={leaving}
      >
        {!leaving && (
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
            <path
              fill="#4285F4"
              d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11a9.5 9.5 0 0 1-4.1 6.2v5.2h6.6c3.9-3.6 6.1-8.8 6.1-15.4Z"
            />
            <path
              fill="#34A853"
              d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.2c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
            />
            <path
              fill="#FBBC05"
              d="M12.6 27.4a12 12 0 0 1 0-6.8v-5.3H5.8a20 20 0 0 0 0 17.4l6.8-5.3Z"
            />
            <path
              fill="#EA4335"
              d="M24 12.2c3 0 5.7 1 7.8 3l5.8-5.8A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.8 15.3l6.8 5.3A12 12 0 0 1 24 12.2Z"
            />
          </svg>
        )}
        {leaving ? "Connecting to Google…" : "Continue with Google"}
      </Button>
    </form>
  );
}
