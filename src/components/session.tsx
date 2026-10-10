"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/api/client";

/** Signed-in owner, provided by AppShell once /api/auth/me resolves (null while loading). */
export const SessionContext = createContext<SessionUser | null>(null);

export const useSessionUser = () => useContext(SessionContext);
