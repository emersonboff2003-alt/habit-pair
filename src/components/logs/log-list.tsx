import { Droplet, Dumbbell, Apple } from "lucide-react";
import type { Log, LogType } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const typeConfig: Record<LogType, { label: string; icon: typeof Droplet; color: string }> = {
  water: { label: "Água", icon: Droplet, color: "text-cyan-300 bg-cyan-500/15" },
  exercise: { label: "Treino", icon: Dumbbell, color: "text-amber-300 bg-amber-500/15" },
  nutrition: { label: "Nutrição", icon: Apple, color: "text-emerald-300 bg-emerald-500/15" },
};

const nutritionLabels: Record<string, string> = {
  macros: "Metas calóricas",
  sweets: "Limite de doces",
  meals: "Refeições",
};

export function LogList({ logs }: { logs: Log[] }) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
      {logs.map((log) => {
        const config = typeConfig[log.type];
        const Icon = config.icon;
        const valueLabel =
          log.type === "water"
            ? `${log.value.toLocaleString("pt-BR")} ml`
            : log.type === "exercise"
              ? `${log.value} min`
              : nutritionLabels[log.description ?? ""] ?? "Check-in";
        return (
          <li key={log.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", config.color)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{valueLabel}</p>
              <p className="text-xs text-muted">{formatDate(log.created_at)}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-violet-300">
              +{log.points_earned} pts
            </span>
          </li>
        );
      })}
    </ul>
  );
}
