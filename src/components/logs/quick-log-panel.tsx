"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { Droplet, Dumbbell, CheckCircle2, Info, Zap, X } from "lucide-react";
import { addLogAction, addQuickExerciseAction } from "@/lib/actions/logs";
import { MealLogPanel } from "@/components/logs/meal-log-panel";
import { ExerciseDetailDialog } from "@/components/logs/exercise-detail-dialog";
import { QUICK_EXERCISE_POINTS } from "@/lib/gamification";
import type { AddLogResult, ExerciseType, FoodItem, MealLog } from "@/types/database";
import { cn } from "@/lib/utils";

interface QuickLogPanelProps {
  foodItems: FoodItem[];
  mealLogsToday: MealLog[];
  exerciseTypes: ExerciseType[];
  quickExerciseDone: boolean;
}

type Feedback = { kind: "success" | "error"; text: string } | null;

const WATER_PRESETS = [250, 500, 750, 1000];

export function QuickLogPanel({
  foodItems,
  mealLogsToday,
  exerciseTypes,
  quickExerciseDone,
}: QuickLogPanelProps) {
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

  function handleWater(ml: number) {
    startTransition(async () => {
      const result: AddLogResult = await addLogAction({ type: "water", value: ml });
      if (result.ok) {
        const missionText =
          result.completedMissionTitles && result.completedMissionTitles.length > 0
            ? ` · Missão concluída: ${result.completedMissionTitles.join(", ")}`
            : "";
        notify({ kind: "success", text: `+${result.pointsEarned} pts${missionText}` });
      } else {
        notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
      }
    });
  }

  function handleQuickExercise() {
    startTransition(async () => {
      const result: AddLogResult = await addQuickExerciseAction();
      if (result.ok) {
        const missionText =
          result.completedMissionTitles && result.completedMissionTitles.length > 0
            ? ` · Missão concluída: ${result.completedMissionTitles.join(", ")}`
            : "";
        notify({ kind: "success", text: `+${result.pointsEarned} pts · treino rápido${missionText}` });
      } else {
        notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
      }
    });
  }

  function handleExerciseResult(result: AddLogResult) {
    if (result.ok) {
      const missionText =
        result.completedMissionTitles && result.completedMissionTitles.length > 0
          ? ` · Missão concluída: ${result.completedMissionTitles.join(", ")}`
          : "";
      notify({ kind: "success", text: `+${result.pointsEarned} pts · treino registrado${missionText}` });
    } else {
      notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
    }
  }

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
              onClick={() => handleWater(ml)}
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
          <span className="ml-auto text-xs text-muted">teto 90/dia</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleQuickExercise}
            disabled={pending || quickExerciseDone}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors active:scale-[0.98] disabled:opacity-50",
              quickExerciseDone
                ? "border-amber-500/20 bg-amber-500/5"
                : "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
            )}
          >
            <span className="flex items-center gap-1 text-sm font-bold text-amber-300">
              <Zap className="h-4 w-4" />
              {quickExerciseDone ? "Feito" : "Treino rápido"}
            </span>
            <span className="text-[11px] text-amber-200/60">
              {quickExerciseDone ? "" : `+${QUICK_EXERCISE_POINTS} pts`}
            </span>
          </button>
          <ExerciseDetailDialog exerciseTypes={exerciseTypes} onResult={handleExerciseResult} />
        </div>
      </div>

      <MealLogPanel mealLogsToday={mealLogsToday} foodItems={foodItems} />

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