import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Droplet, Dumbbell, Apple, Sparkles, Star, Flame } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getProfiles, getTodayLogs, getLogsForRange } from "@/lib/data";
import { computeTodayTotals, computeStreak, DAILY_TARGETS } from "@/lib/gamification";
import { dateKeyInTimeZone, dayStartToUtc, hourInTimeZone, shiftDateKey } from "@/lib/utils";
import { HabitCard } from "@/components/dashboard/habit-card";
import { GoalsDialog } from "@/components/dashboard/goals-dialog";
import { LeaderboardSection, LeaderboardSkeleton } from "@/components/dashboard/leaderboard-section";

export const dynamic = "force-dynamic";

function greetingFor(hour: number): string {
  if (hour < 6) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const profiles = await getProfiles();
  const current = profiles.find((p) => p.id === profileId);
  if (!current) redirect("/select-profile");

  const logsByUser = await Promise.all(profiles.map((p) => getTodayLogs(p.id)));
  const currentIndex = profiles.findIndex((p) => p.id === profileId);
  const myGoals = {
    water: current.water_goal_ml ?? DAILY_TARGETS.water,
    exercise: current.exercise_goal_min ?? DAILY_TARGETS.exercise,
  };
  const myTotals = computeTodayTotals(logsByUser[currentIndex] ?? [], myGoals);

  const streakFrom = dayStartToUtc(shiftDateKey(dateKeyInTimeZone(), -90));
  const streakLogs = await getLogsForRange(profileId, streakFrom, new Date().toISOString());
  const streak = computeStreak(streakLogs);

  const waterLabel = `${myTotals.waterMl.toLocaleString("pt-BR")} / ${myGoals.water.toLocaleString("pt-BR")} ml`;
  const exerciseLabel = `${myTotals.exerciseMin} / ${myGoals.exercise} min`;
  const nutritionLabel =
    myTotals.nutritionDone.length >= DAILY_TARGETS.nutrition
      ? "Meta batida!"
      : `${myTotals.nutritionDone.length}/${DAILY_TARGETS.nutrition} refeições`;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <p className="text-sm text-muted">
          {greetingFor(hourInTimeZone())},{" "}
          <span className="font-semibold text-fg-2">{current.name}</span>
        </p>
        <h1 className="text-xl font-bold tracking-tight">Como estão seus hábitos hoje?</h1>
      </div>

      {streak > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <Flame className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
          </span>
        </div>
      )}

      {/* Cartão de pontos */}
      <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/20 via-card to-accent-2/10 p-5">
        <Sparkles className="absolute -right-4 -top-4 h-24 w-24 text-accent/10" />
        <div className="flex items-end justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-accent" /> Saldo de pontos
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-foreground">
              {current.points_balance.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pontos hoje</p>
            <p className="text-lg font-bold text-accent">
              +{myTotals.totalPointsToday}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          {current.total_points_earned.toLocaleString("pt-BR")} pontos ganhos no total
        </p>
      </div>

      {/* Progresso do dia */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">Hoje</h2>
          <GoalsDialog waterGoal={myGoals.water} exerciseGoal={myGoals.exercise} />
        </div>
        <HabitCard
          title="Água"
          icon={Droplet}
          accent="water"
          value={myTotals.waterMl}
          target={myGoals.water}
          unit="ml"
          percent={myTotals.waterPercent}
          points={myTotals.waterPoints}
          capReached={myTotals.waterCapped}
          doneLabel={waterLabel}
        />
        <HabitCard
          title="Exercício"
          icon={Dumbbell}
          accent="exercise"
          value={myTotals.exerciseMin}
          target={myGoals.exercise}
          unit="min"
          percent={myTotals.exercisePercent}
          points={myTotals.exercisePoints}
          capReached={myTotals.exerciseCapped}
          doneLabel={exerciseLabel}
        />
        <HabitCard
          title="Refeições"
          icon={Apple}
          accent="nutrition"
          value={myTotals.nutritionDone.length}
          target={DAILY_TARGETS.nutrition}
          unit="refeições"
          percent={myTotals.nutritionPercent}
          points={myTotals.nutritionPoints}
          capReached={myTotals.nutritionDone.length >= DAILY_TARGETS.nutrition}
          doneLabel={nutritionLabel}
        />
      </div>

      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardSection />
      </Suspense>
    </div>
  );
}
