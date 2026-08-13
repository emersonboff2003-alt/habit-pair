import { getProfiles, getLogsForRange } from "@/lib/data";
import { dateKeyInTimeZone, dayStartToUtc, shiftDateKey } from "@/lib/utils";
import { Leaderboard } from "@/components/dashboard/leaderboard";

const sumSince = (logs: { created_at: string; points_earned: number }[], since: string) =>
  logs.filter((l) => l.created_at >= since).reduce((s, l) => s + l.points_earned, 0);

/** Busca os dados do placar (hoje/semana/mês) — streamed com Suspense no dashboard. */
export async function LeaderboardSection() {
  const profiles = await getProfiles();

  const todayKey = dateKeyInTimeZone();
  const todayStart = dayStartToUtc(todayKey);
  const weekStart = dayStartToUtc(shiftDateKey(todayKey, -6));
  const monthStart = dayStartToUtc(shiftDateKey(todayKey, -29));

  const logsByUser = await Promise.all(
    profiles.map((p) => getLogsForRange(p.id, monthStart, new Date().toISOString())),
  );

  const entries = profiles.map((profile, index) => {
    const logs = logsByUser[index] ?? [];
    return {
      profile,
      today: sumSince(logs, todayStart),
      week: sumSince(logs, weekStart),
      month: sumSince(logs, monthStart),
    };
  });

  return <Leaderboard entries={entries} />;
}

export function LeaderboardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
      <div className="h-5 w-28 rounded-full bg-raised" />
      <div className="mt-4 space-y-4">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 rounded-full bg-raised" />
                <div className="h-3 w-28 rounded-full bg-raised" />
              </div>
              <div className="h-4 w-10 rounded-full bg-raised" />
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
