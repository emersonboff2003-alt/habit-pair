"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteLogAction } from "@/lib/actions/logs";
import { cn } from "@/lib/utils";

/**
 * Botão de excluir um registro (log). Usa confirmação em dois toques: o
 * primeiro "arma" o botão (mostra "Apagar?"), o segundo confirma a exclusão.
 * Reverte os pontos e o progresso das missões via ação do servidor.
 */
export function DeleteLogButton({ logId }: { logId: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function arm() {
    setArmed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setArmed(false), 3000);
  }

  function confirm() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setArmed(false);
    startTransition(async () => {
      await deleteLogAction(logId);
    });
  }

  return (
    <button
      type="button"
      onClick={armed ? confirm : arm}
      disabled={pending}
      className={cn(
        "flex h-8 shrink-0 items-center justify-center rounded-lg px-2 text-muted transition-colors",
        armed
          ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
          : "hover:bg-raised hover:text-red-400",
        pending && "opacity-50",
      )}
      aria-label="Excluir registro"
      title="Excluir registro"
    >
      {armed ? <span className="text-xs font-semibold">Apagar?</span> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
