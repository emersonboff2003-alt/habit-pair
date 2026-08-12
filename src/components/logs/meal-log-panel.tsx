"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { Apple, CheckCircle2, Check, Coffee, Cookie, Info, Moon, Soup, X, Zap } from "lucide-react";
import { addQuickMealAction } from "@/lib/actions/logs";
import { MEAL_SLOTS, MEAL_SLOT_LABELS, QUICK_MEAL_POINTS } from "@/lib/gamification";
import { MealDetailDialog } from "@/components/logs/meal-detail-dialog";
import type { AddLogResult, FoodItem, MealLog, MealSlot } from "@/types/database";
import { cn } from "@/lib/utils";

interface MealLogPanelProps {
  mealLogsToday: MealLog[];
  foodItems: FoodItem[];
}

type Feedback = { kind: "success" | "error"; text: string } | null;

const SLOT_ICONS: Record<MealSlot, typeof Coffee> = {
  breakfast: Coffee,
  lunch: Soup,
  afternoon: Cookie,
  dinner: Moon,
};

export function MealLogPanel({ mealLogsToday, foodItems }: MealLogPanelProps) {
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

  function handleQuick(slot: MealSlot) {
    startTransition(async () => {
      const result: AddLogResult = await addQuickMealAction(slot);
      if (result.ok) {
        const missionText =
          result.completedMissionTitles && result.completedMissionTitles.length > 0
            ? ` · Missão concluída: ${result.completedMissionTitles.join(", ")}`
            : "";
        notify({
          kind: "success",
          text: `+${result.pointsEarned} pts · ${MEAL_SLOT_LABELS[slot]} rápido${missionText}`,
        });
      } else {
        notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
      }
    });
  }

  function handleDetailedResult(result: AddLogResult, slot: MealSlot) {
    if (result.ok) {
      const missionText =
        result.completedMissionTitles && result.completedMissionTitles.length > 0
          ? ` · Missão concluída: ${result.completedMissionTitles.join(", ")}`
          : "";
      notify({
        kind: "success",
        text: `+${result.pointsEarned} pts · ${MEAL_SLOT_LABELS[slot]} registrado${missionText}`,
      });
    } else {
      notify({ kind: "error", text: result.error ?? "Não foi possível registrar." });
    }
  }

  const slotsState = MEAL_SLOTS.map((slot) => {
    const meals = mealLogsToday.filter((m) => m.slot === slot);
    return {
      slot,
      hasAny: meals.length > 0,
      hasQuick: meals.some((m) => m.is_quick),
    };
  });

  return (
    <div className="animate-fade-in-up space-y-3">
      <div className="flex items-center gap-2">
        <Apple className="h-5 w-5 text-emerald-300" />
        <h2 className="text-sm font-semibold">Refeições</h2>
        <span className="ml-auto text-xs text-muted">1 rápida por horário/dia · teto 100/dia</span>
      </div>

      <div className="space-y-2.5">
        {slotsState.map(({ slot, hasAny, hasQuick }) => {
          const Icon = SLOT_ICONS[slot];
          const done = hasAny;
          return (
            <div
              key={slot}
              className={cn(
                "rounded-2xl border p-3.5 transition-colors",
                done
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-emerald-500/30 bg-emerald-500/5",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-emerald-500/25 text-emerald-300"
                      : "bg-emerald-500/15 text-emerald-400",
                  )}
                >
                  {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{MEAL_SLOT_LABELS[slot]}</p>
                  <p className="truncate text-xs text-muted">
                    {hasQuick
                      ? "Refeição rápida registrada"
                      : hasAny
                        ? "Refeição registrada"
                        : "+10 pts rápido · detalhar vale mais"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuick(slot)}
                  disabled={pending || hasAny}
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    hasAny
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300/70"
                      : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 active:scale-[0.98]",
                  )}
                >
                  <Zap />
                  {hasAny ? "Feito" : `Rápida · +${QUICK_MEAL_POINTS} pts`}
                </button>
                <MealDetailDialog
                  slot={slot}
                  foodItems={foodItems}
                  onResult={(result) => handleDetailedResult(result, slot)}
                />
              </div>
            </div>
          );
        })}
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