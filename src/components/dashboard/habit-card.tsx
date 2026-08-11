import type { LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type HabitAccent = "water" | "exercise" | "nutrition";

interface HabitCardProps {
  title: string;
  icon: LucideIcon;
  accent: HabitAccent;
  value: number;
  target: number;
  unit: string;
  percent: number;
  points: number;
  capReached: boolean;
  doneLabel?: string;
}

const accentStyles: Record<
  HabitAccent,
  { iconBg: string; iconColor: string; bar: string; badge: string }
> = {
  water: {
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-300",
    bar: "bg-cyan-400",
    badge: "bg-cyan-500/15 text-cyan-300",
  },
  exercise: {
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-300",
    bar: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
  },
  nutrition: {
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-300",
    bar: "bg-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
};

export function HabitCard({
  title,
  icon: Icon,
  accent,
  value,
  target,
  unit,
  percent,
  points,
  capReached,
  doneLabel,
}: HabitCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.iconColor)} />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted">
              {doneLabel ??
                `${value.toLocaleString("pt-BR")} / ${target.toLocaleString("pt-BR")} ${unit}`}
            </p>
          </div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", styles.badge)}>
          +{points} pts
        </span>
      </div>

      <Progress
        value={percent}
        className="mt-4"
        indicatorClassName={styles.bar}
        aria-label={`${title}: ${percent}%`}
      />

      {capReached && (
        <p className="mt-2 text-right text-[11px] font-medium text-muted">
          Teto de pontos do dia atingido
        </p>
      )}
    </div>
  );
}
