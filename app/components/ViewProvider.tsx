"use client";

import { createContext, useContext, useState } from "react";
import type { ViewMode } from "../lib/types";

interface ViewCtx {
  view: ViewMode;
  setView: (v: ViewMode) => void;
}

const Ctx = createContext<ViewCtx>({ view: "통합", setView: () => {} });

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<ViewMode>("통합");
  return <Ctx.Provider value={{ view, setView }}>{children}</Ctx.Provider>;
}

export const useView = () => useContext(Ctx);
