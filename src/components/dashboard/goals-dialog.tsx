"use client";

import { useState, useTransition } from "react";
import { Target, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateGoalsAction } from "@/lib/actions/goals";
import { DAILY_TARGETS } from "@/lib/gamification";
import { cn } from "@/lib/utils";

interface GoalsDialogProps {
  waterGoal: number;
  exerciseGoal: number;
}

type Message = { kind: "success" | "error"; text: string } | null;

export function GoalsDialog({ waterGoal, exerciseGoal }: GoalsDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [water, setWater] = useState(String(waterGoal ?? DAILY_TARGETS.water));
  const [exercise, setExercise] = useState(String(exerciseGoal ?? DAILY_TARGETS.exercise));
  const [message, setMessage] = useState<Message>(null);

  function reset() {
    setWater(String(waterGoal ?? DAILY_TARGETS.water));
    setExercise(String(exerciseGoal ?? DAILY_TARGETS.exercise));
    setMessage(null);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateGoalsAction(Number(water), Number(exercise));
      setMessage(
        res.ok
          ? { kind: "success", text: "Metas salvas" }
          : { kind: "error", text: res.error ?? "Não foi possível salvar." },
      );
      if (res.ok) setOpen(false);
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
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-fg-2 transition-colors hover:bg-raised"
        >
          <Target className="h-3.5 w-3.5" />
          Ajustar metas
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Minhas metas diárias</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Água (ml por dia)</span>
            <input
              type="number"
              min={500}
              max={10000}
              step={50}
              value={water}
              onChange={(e) => setWater(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Exercício (min por dia)</span>
            <input
              type="number"
              min={5}
              max={300}
              step={5}
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          {message && (
            <p
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                message.kind === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-red-900 bg-red-950/40 text-red-300",
              )}
            >
              {message.text}
            </p>
          )}

          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar metas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
