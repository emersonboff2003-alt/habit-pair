"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botão "Instalar" que aparece quando o navegador dispara
 * `beforeinstallprompt` (Android/Chrome/Edge). No iOS o usuário usa
 * "Adicionar à Tela de Início" pelo menu do Safari.
 */
export function InstallPwaButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!promptEvent) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await promptEvent.prompt();
        setPromptEvent(null);
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-card text-zinc-300 transition-colors hover:bg-card-hover"
      aria-label="Instalar aplicativo"
      title="Instalar aplicativo"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
