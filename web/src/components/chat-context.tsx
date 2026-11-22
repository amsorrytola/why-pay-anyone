"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PageState = Record<string, string | number | boolean>;

type Ctx = {
  page: string;
  state: PageState;
  setPage: (page: string, state: PageState) => void;
};

const ChatCtx = createContext<Ctx>({ page: "home", state: {}, setPage: () => {} });

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const [page, setPageName] = useState("home");
  const [state, setState] = useState<PageState>({});
  const setPage = useCallback((p: string, s: PageState) => {
    setPageName(p);
    setState(s);
  }, []);
  const value = useMemo(() => ({ page, state, setPage }), [page, state, setPage]);
  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

export function useChatContext() {
  return useContext(ChatCtx);
}

/** Pages call this so the chatbot knows which page is open and what the sliders are set to. */
export function usePageState(page: string, state: PageState) {
  const { setPage } = useChatContext();
  const key = JSON.stringify(state);
  useEffect(() => {
    setPage(page, JSON.parse(key));
  }, [page, key, setPage]);
}
