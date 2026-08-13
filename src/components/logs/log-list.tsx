import { Droplet, Dumbbell, Apple } from "lucide-react";
import type { ExerciseType, Log, LogType } from "@/types/database";
import { parseMealDescription, MEAL_SLOT_LABELS } from "@/lib/gamification";
import { DeleteLogButton } from "@/components/logs/delete-log-button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const typeConfig: Record<LogType, { label: string; icon: typeof Droplet; color: string }> = {
  water: { label: "Água", icon: Droplet, color: "text-cyan-300 bg-cyan-500/15" },
  exercise: { label: "Treino", icon: Dumbbell, color: "text-amber-300 bg-amber-500/15" },
  nutrition: { label: "Refeição", icon: Apple, color: "text-emerald-300 bg-emerald-500/15" },
};

const nutritionLabels: Record<string, string> = {
  macros: "Metas calóricas",
  sweets: "Limite de doces",
  meals: "Refeições",
};

export function LogList({
  logs,
  exerciseTypes = [],
  mealSummaries = {},
}: {
  logs: Log[];
  exerciseTypes?: ExerciseType[];
  mealSummaries?: Record<string, string>;
}) {
  const typeNameById = new Map(exerciseTypes.map((t) => [t.id, t.name]));

  function valueLabel(log: Log): string {
    if (log.type === "water") {
      return `${log.value.toLocaleString("pt-BR")} ml`;
    }
    if (log.type === "exercise") {
      const typeName = log.exercise_type_id ? typeNameById.get(log.exercise_type_id) : null;
      const minutes = `${log.value} min`;
      const distance = log.description && log.description !== "quick" ? ` · ${log.description}` : "";
      if (log.description === "quick") return "Treino rápido";
      return typeName ? `${typeName} · ${minutes}${distance}` : `${minutes}${distance}`;
    }
    if (log.type === "nutrition") {
      const meal = parseMealDescription(log.description);
      if (meal) {
        const slot = MEAL_SLOT_LABELS[meal.slot];
        if (meal.isQuick) return `${slot} · Ref. rápida`;
        const summary = mealSummaries[meal.mealLogId];
        return summary ? `${slot} · ${summary}` : slot;
      }
      return nutritionLabels[log.description ?? ""] ?? "Check-in";
    }
    return "Registro";
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {logs.map((log) => {
        const config = typeConfig[log.type];
        const Icon = config.icon;
        return (
          <li key={log.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", config.color)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{valueLabel(log)}</p>
              <p className="text-xs text-muted">{formatDate(log.created_at)}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-violet-300">
              +{log.points_earned} pts
            </span>
            <DeleteLogButton logId={log.id} />
          </li>
        );
      })}
    </ul>
  );
}