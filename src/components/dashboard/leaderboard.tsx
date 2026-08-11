import { Trophy, Star } from "lucide-react";
import type { Profile } from "@/types/database";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface LeaderboardEntry {
  profile: Profile;
  todayPoints: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const maxToday = Math.max(1, ...entries.map((e) => e.todayPoints));
  const sorted = [...entries].sort((a, b) => b.todayPoints - a.todayPoints);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-300" />
        <h2 className="text-sm font-semibold">Placar de hoje</h2>
      </div>

      <div className="space-y-4">
        {sorted.map((entry, index) => (
          <div key={entry.profile.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-bold text-zinc-950",
                    index === 0 && "ring-2 ring-amber-400",
                  )}
                >
                  {initials(entry.profile.name)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{entry.profile.name}</p>
                  <p className="text-xs text-zinc-500">
                    <Star className="mr-1 inline h-3 w-3 text-violet-400" />
                    {entry.profile.points_balance.toLocaleString("pt-BR")} pts no total
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-zinc-100">
                {entry.todayPoints} pts
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  index === 0 ? "bg-amber-400" : "bg-zinc-500",
                )}
                style={{ width: `${Math.round((entry.todayPoints / maxToday) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
