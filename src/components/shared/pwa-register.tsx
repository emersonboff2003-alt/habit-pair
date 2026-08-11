"use client";

import { useEffect } from "react";

/**
 * Registra o service worker do PWA. Executa apenas no navegador e apenas
 * em produção (no dev o Next já gerencia o hot-reload).
 *
 * Também checa por atualizações quando o app volta ao primeiro plano, para
 * que o app instalado na tela inicial baixe versões novas (com novo HTML/JS)
 * sem exigir o usuário fechar/limpar cache manualmente.
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
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // Verifica atualização do service worker quando o app ganha foco,
        // garantindo que uma versão nova seja baixada no próximo uso.
        const checkForUpdates = () => {
          reg.update().catch(() => {
            /* offline/erro: tenta de novo na próxima vez */
          });
        };
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdates();
        });
        checkForUpdates();
      } catch (error) {
        console.error("Falha ao registrar service worker:", error);
      }
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
