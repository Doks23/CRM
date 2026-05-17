"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { SessionProvider } from "next-auth/react";

type SidebarContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </SessionProvider>
  );
}
