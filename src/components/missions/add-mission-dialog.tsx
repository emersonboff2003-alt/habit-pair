"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createMissionAction } from "@/lib/actions/missions";
import { LOG_TYPE_LABELS } from "@/lib/gamification";
import type { LogType } from "@/types/database";

const TARGET_TYPES: LogType[] = ["water", "exercise", "nutrition"];

export function AddMissionDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<LogType>("water");
  const [targetValue, setTargetValue] = useState("");
  const [durationDays, setDurationDays] = useState("1");
  const [rewardPoints, setRewardPoints] = useState("");
  const [isCooperative, setIsCooperative] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setTargetType("water");
    setTargetValue("");
    setDurationDays("1");
    setRewardPoints("");
    setIsCooperative(false);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createMissionAction({
        title,
        description,
        targetType,
        targetValue: Number(targetValue),
        durationDays: Number(durationDays),
        rewardPoints: Number(rewardPoints),
        isCooperative,
      });
      if (res.ok) {
        setOpen(false);
      } else {
        setError(res.error ?? "Não foi possível criar a missão.");
      }
    });
  }

  const canSave =
    title.trim() && Number(targetValue) > 0 && Number(durationDays) > 0 && Number(rewardPoints) > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-fg-2 transition-colors hover:bg-raised"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova missão
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova missão</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Título</span>
            <input
              type="text"
              value={title}
              maxLength={100}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Reto de hidratação"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Descrição (opcional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Beba 2L por dia durante 5 dias"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Tipo</span>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as LogType)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none"
            >
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LOG_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-fg-2">Meta</span>
              <input
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Ex.: 2500"
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-fg-2">Dias</span>
              <input
                type="number"
                min={1}
                max={30}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Recompensa (pontos)</span>
            <input
              type="number"
              min={1}
              value={rewardPoints}
              onChange={(e) => setRewardPoints(e.target.value)}
              placeholder="Ex.: 100"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
            <span className="text-sm text-fg-2">Missão em dupla (cooperativa)</span>
            <input
              type="checkbox"
              checked={isCooperative}
              onChange={(e) => setIsCooperative(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <Button type="button" onClick={handleCreate} disabled={pending || !canSave}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar missão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
