"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { ExerciseType, Log } from "@/types/database";
import { APP_TIME_ZONE, cn, dateKeyForIso, dateKeyInTimeZone, dayStartToUtc } from "@/lib/utils";
import { LogList } from "@/components/logs/log-list";

interface HistoryViewProps {
  year: number;
  month: number; // 1-based
  monthLabel: string;
  logs: Log[];
  exerciseTypes: ExerciseType[];
  mealSummaries: Record<string, string>;
  prevMonth: string; // "YYYY-MM"
  nextMonth: string; // "YYYY-MM"
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");

function weekdayOfInstant(iso: string): number {
  const dow = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dow);
}

export function HistoryView({
  year,
  month,
  monthLabel,
  logs,
  exerciseTypes,
  mealSummaries,
  prevMonth,
  nextMonth,
}: HistoryViewProps) {
  const todayKey = dateKeyInTimeZone();

  const byDay = useMemo(() => {
    const map = new Map<string, Log[]>();
    for (const log of logs) {
      const key = dateKeyForIso(log.created_at);
      const arr = map.get(key) ?? [];
      arr.push(log);
      map.set(key, arr);
    }
    return map;
  }, [logs]);

  const pointsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, arr] of byDay) {
      map.set(key, arr.reduce((sum, l) => sum + l.points_earned, 0));
    }
    return map;
  }, [byDay]);

  const monthTotal = useMemo(
    () => logs.reduce((sum, l) => sum + l.points_earned, 0),
    [logs],
  );

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = weekdayOfInstant(dayStartToUtc(`${year}-${pad(month)}-01`));

  const [selected, setSelected] = useState<string | null>(() =>
    byDay.has(todayKey) ? todayKey : null,
  );
  const selectedLogs = selected ? (byDay.get(selected) ?? []) : [];

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${pad(month)}-${pad(day)}`);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/history?month=${prevMonth}`}
            aria-label="Mês anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-raised"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">{monthLabel}</span>
          </div>
          <Link
            href={`/history?month=${nextMonth}`}
            aria-label="Próximo mês"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-raised"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-1 text-center text-[11px] font-medium text-muted">
              {d}
            </span>
          ))}

          {cells.map((key, i) => {
            if (key === null) return <span key={`empty-${i}`} />;
            const points = pointsByDay.get(key) ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const dayNum = Number(key.slice(8, 10));
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(isSelected ? null : key)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                  isSelected
                    ? "border-accent bg-accent/20 text-foreground"
                    : isToday
                      ? "border-accent/40 bg-accent/5 text-foreground"
                      : points > 0
                        ? "border-emerald-500/20 bg-emerald-500/5 text-foreground hover:bg-raised"
                        : "border-transparent text-muted hover:bg-raised",
                )}
              >
                <span className={cn("leading-none", isToday && "font-bold")}>{dayNum}</span>
                {points > 0 && (
                  <span className="mt-0.5 text-[9px] font-semibold text-accent">+{points}</span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
          <span className="font-semibold text-accent">+{monthTotal}</span> pontos no mês
        </p>
      </div>

      {selected ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Registros de {new Date(selected + "T12:00:00").toLocaleDateString("pt-BR")}
          </h2>
          {selectedLogs.length > 0 ? (
            <LogList logs={selectedLogs} exerciseTypes={exerciseTypes} mealSummaries={mealSummaries} />
          ) : (
            <p className="text-sm text-muted">Nenhum registro neste dia.</p>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">Toque em um dia para ver os registros.</p>
      )}
    </div>
  );
}
