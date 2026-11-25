"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Hides its children on the given routes (the journey is full-screen and has its own controls). */
export function HideOn(props: { paths: string[]; children: ReactNode }) {
  const path = usePathname();
  if (props.paths.includes(path)) return null;
  return <>{props.children}</>;
}
