"use client";

import { useState } from "react";
import { Trophy, Star } from "lucide-react";
import type { Profile } from "@/types/database";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface LeaderboardEntry {
  profile: Profile;
  today: number;
  week: number;
  month: number;
}

type Period = "today" | "week" | "month";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
];

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const [period, setPeriod] = useState<Period>("today");

  const sorted = [...entries].sort((a, b) => b[period] - a[period]);
  const maxToday = Math.max(1, ...sorted.map((e) => e[period]));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <h2 className="text-sm font-semibold">Placar</h2>
        </div>
        <div className="flex rounded-lg border border-border bg-raised p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                period === p.id ? "bg-card text-foreground" : "text-muted hover:text-fg-2",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sorted.map((entry, index) => (
          <div key={entry.profile.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-bold text-zinc-950",
                    index === 0 && "ring-2 ring-amber-400",
                  )}
                >
                  {initials(entry.profile.name)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{entry.profile.name}</p>
                  <p className="text-xs text-muted">
                    <Star className="mr-1 inline h-3 w-3 text-accent" />
                    {entry.profile.points_balance.toLocaleString("pt-BR")} pts no total
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-foreground">
                {entry[period]} pts
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  index === 0 ? "bg-amber-400" : "bg-muted-foreground",
                )}
                style={{ width: `${Math.round((entry[period] / maxToday) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
