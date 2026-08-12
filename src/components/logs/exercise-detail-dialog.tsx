"use client";

import { useState, useTransition } from "react";
import { Dumbbell, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addDetailedExerciseAction } from "@/lib/actions/logs";
import type { AddLogResult, ExerciseType } from "@/types/database";
import { cn } from "@/lib/utils";

interface ExerciseDetailDialogProps {
  exerciseTypes: ExerciseType[];
  onResult?: (result: AddLogResult) => void;
}

const MINUTE_PRESETS = [15, 30, 45, 60];

export function ExerciseDetailDialog({ exerciseTypes, onResult }: ExerciseDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number>(30);
  const [distance, setDistance] = useState("");
  const [error, setError] = useState<string | null>(null);

  const previewPoints = Math.min(90, minutes) || 0;

  function reset() {
    setTypeId(null);
    setMinutes(30);
    setDistance("");
    setError(null);
  }

  function handleSave() {
    if (!typeId) {
      setError("Escolha a modalidade do treino.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addDetailedExerciseAction(typeId, minutes, distance.trim() || undefined);
      if (result.ok) {
        reset();
        setOpen(false);
        onResult?.(result);
      } else {
        setError(result.error ?? "Não foi possível salvar o treino.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="exercise" size="sm">
          <Dumbbell className="h-4 w-4" />
          Detalhar treino
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhar treino</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Modalidade</p>
          <div className="grid grid-cols-2 gap-2">
            {exerciseTypes.map((type) => {
              const active = typeId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setTypeId(type.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-border text-foreground hover:bg-raised",
                  )}
                >
                  <span className="truncate">{type.name}</span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Duração</p>
          <div className="grid grid-cols-4 gap-2">
            {MINUTE_PRESETS.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setMinutes(min)}
                className={cn(
                  "rounded-xl border py-2 text-sm font-semibold transition-colors",
                  minutes === min
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-border text-foreground hover:bg-raised",
                )}
              >
                {min}m
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 0))}
            placeholder="Minutos (1–600)"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Distância (opcional)</p>
          <input
            type="text"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="Ex.: 5 km"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm">
          <p className="flex justify-between font-semibold">
            <span>{minutes} min · +{minutes} pts</span>
            <span className="text-amber-300">teto 90/dia</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Detalhar o treino rende 1 pt por minuto (igual hoje). No preview acima o teto do dia
            ainda não é considerado.
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button type="button" variant="exercise" onClick={handleSave} disabled={pending || !typeId}>
          Registrar treino ({previewPoints} pts)
        </Button>
      </DialogContent>
    </Dialog>
  );
}