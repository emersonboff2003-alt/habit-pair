import { getProfiles, getTodayLogs } from "@/lib/data";
import { computeTodayTotals } from "@/lib/gamification";
import { Leaderboard } from "@/components/dashboard/leaderboard";

/** Busca os dados do placar de hoje (streamed com Suspense no dashboard). */
export async function LeaderboardSection() {
  const profiles = await getProfiles();
  const totalsByUser = await Promise.all(profiles.map((p) => getTodayLogs(p.id)));
  const entries = profiles.map((profile, index) => ({
    profile,
    todayPoints: totalsByUser[index] ? computeTodayTotals(totalsByUser[index]).totalPointsToday : 0,
  }));

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