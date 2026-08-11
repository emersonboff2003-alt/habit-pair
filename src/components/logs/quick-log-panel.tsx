"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { Check, Droplet, Dumbbell, Apple, CheckCircle2, Info, X } from "lucide-react";
import { addLogAction } from "@/lib/actions/logs";
import type { AddLogResult, NutritionCategory } from "@/types/database";
import { NUTRITION_CATEGORIES, NUTRITION_LABELS } from "@/lib/gamification";
import { cn } from "@/lib/utils";

interface QuickLogPanelProps {
  nutritionDone: NutritionCategory[];
}

type Feedback = { kind: "success" | "error"; text: string } | null;

const WATER_PRESETS = [500, 250];
const EXERCISE_PRESETS = [15, 30, 45];

export function QuickLogPanel({ nutritionDone }: QuickLogPanelProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function notify(fb: Feedback) {
    setFeedback(fb);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), 4000);
  }

  function handleLog(type: "water" | "exercise", value: number) {
    startTransition(async () => {
      const result: AddLogResult = await addLogAction({ type, value });
      if (result.ok) {
        const missionText =
          result.completedMissionTitles && result.completedMissionTitles.length > 0
            ? ` · Missão concluída: ${result.completedMissionTitles.join(", ")}`
            : "";
        notify({
          kind: "success",
          text: `+${result.pointsEarned} pts${missionText}`,
        });
      } else {
        notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
      }
    });
  }

  function handleNutrition(category: NutritionCategory) {
    startTransition(async () => {
      const result: AddLogResult = await addLogAction({
        type: "nutrition",
        value: 1,
        description: category,
      });
      if (result.ok) {
        notify({ kind: "success", text: `+${result.pointsEarned} pts · Check-in registrado` });
      } else {
        notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
      }
    });
  }

  const allDone = nutritionDone.length >= NUTRITION_CATEGORIES.length;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up space-y-3">
        <div className="flex items-center gap-2">
          <Droplet className="h-5 w-5 text-cyan-300" />
          <h2 className="text-sm font-semibold">Água</h2>
          <span className="ml-auto text-xs text-muted">+10 pts / 500ml · teto 50/dia</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {WATER_PRESETS.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => handleLog("water", ml)}
              disabled={pending}
              className="flex h-16 flex-col items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 transition-colors hover:bg-cyan-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-lg font-bold text-cyan-300">+{ml}ml</span>
              <span className="text-[11px] text-cyan-200/60">
                +{Math.floor(ml / 500) * 10} pts
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in-up space-y-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-amber-300" />
          <h2 className="text-sm font-semibold">Exercício</h2>
          <span className="ml-auto text-xs text-muted">+1 pt / min · teto 90/dia</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {EXERCISE_PRESETS.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => handleLog("exercise", min)}
              disabled={pending}
              className="flex h-16 flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 transition-colors hover:bg-amber-500/20 active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-lg font-bold text-amber-300">+{min}m</span>
              <span className="text-[11px] text-amber-200/60">+{min} pts</span>
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in-up space-y-3">
        <div className="flex items-center gap-2">
          <Apple className="h-5 w-5 text-emerald-300" />
          <h2 className="text-sm font-semibold">Check-in nutricional</h2>
          <span className="ml-auto text-xs text-muted">1 por categoria/dia</span>
        </div>
        <div className="space-y-2.5">
          {NUTRITION_CATEGORIES.map((category) => {
            const done = nutritionDone.includes(category);
            const info = NUTRITION_LABELS[category];
            return (
              <button
                key={category}
                type="button"
                onClick={() => handleNutrition(category)}
                disabled={pending || done}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed",
                  done
                    ? "border-emerald-500/40 bg-emerald-500/10 opacity-80"
                    : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    done ? "bg-emerald-500/25 text-emerald-300" : "bg-emerald-500/15 text-emerald-400",
                  )}
                >
                  {done ? <Check className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{info.label}</span>
                  <span className="block truncate text-xs text-muted">{info.description}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                    done ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-500/15 text-emerald-300",
                  )}
                >
                  {done ? "Feito" : `+${info.points} pts`}
                </span>
              </button>
            );
          })}
          {allDone && (
            <p className="text-center text-xs font-medium text-emerald-300">
              Todas as metas nutricionais de hoje foram registradas!
            </p>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={cn(
            "fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl animate-pop",
            feedback.kind === "success"
              ? "border-emerald-500/40 bg-raised"
              : "border-red-500/40 bg-raised",
          )}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <Info className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <p className="flex-1 text-sm text-foreground">{feedback.text}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-muted hover:text-fg-2"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
