"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMissionAction } from "@/lib/actions/missions";
import { cn } from "@/lib/utils";

/** Botão de excluir missão (dois toques para confirmar). */
export function DeleteMissionButton({ missionId }: { missionId: string }) {
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
      await deleteMissionAction(missionId);
    });
  }

  return (
    <button
      type="button"
      onClick={armed ? confirm : arm}
      disabled={pending}
      className={cn(
        "flex h-7 shrink-0 items-center justify-center rounded-lg px-2 text-muted transition-colors",
        armed
          ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
          : "hover:bg-raised hover:text-red-400",
        pending && "opacity-50",
      )}
      aria-label="Excluir missão"
      title="Excluir missão"
    >
      {armed ? <span className="text-xs font-semibold">Apagar?</span> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}
