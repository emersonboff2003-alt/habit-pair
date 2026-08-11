"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do PWA. Executa apenas no navegador e apenas
 * em produção (no dev o Next já gerencia o hot-reload).
 */
export function PwaRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("Falha ao registrar service worker:", error);
      }
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
