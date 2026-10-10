import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export function StoreEffects() {
  useEffect(() => {
    let alive = true;
    const done = () => {
      if (alive) useAppStore.getState().setHydrated();
    };
    void Promise.resolve(useAppStore.persist.rehydrate()).finally(done);
    const fallback = setTimeout(done, 120);
    return () => {
      alive = false;
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      useAppStore.getState().tick(Date.now());
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return null;
}
