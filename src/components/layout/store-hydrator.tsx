"use client";

import { useEffect } from "react";
import { useStore } from "@/store/store";

/** Defers persist rehydration to after mount so server + first client render match (no hydration mismatch). */
export function StoreHydrator() {
  useEffect(() => {
    useStore.persist.rehydrate();
  }, []);
  return null;
}
