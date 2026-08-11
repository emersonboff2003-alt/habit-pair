import { redirect } from "next/navigation";
import { Droplet, Dumbbell, Apple, Sparkles, Star } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getProfiles, getTodayLogs } from "@/lib/data";
import { computeTodayTotals, DAILY_TARGETS } from "@/lib/gamification";
import { HabitCard } from "@/components/dashboard/habit-card";
import { Leaderboard } from "@/components/dashboard/leaderboard";

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
  const totalsByUser = logsByUser.map((logs) => computeTodayTotals(logs));
  const currentIndex = profiles.findIndex((p) => p.id === profileId);
  const myTotals = totalsByUser[currentIndex] ?? computeTodayTotals([]);

  const waterLabel = `${myTotals.waterMl.toLocaleString("pt-BR")} / ${DAILY_TARGETS.water.toLocaleString("pt-BR")} ml`;
  const exerciseLabel = `${myTotals.exerciseMin} / ${DAILY_TARGETS.exercise} min`;
  const nutritionLabel =
    myTotals.nutritionDone.length >= DAILY_TARGETS.nutrition
      ? "Meta batida!"
      : `${myTotals.nutritionDone.length}/${DAILY_TARGETS.nutrition} check-ins`;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <p className="text-sm text-zinc-500">
          {greetingFor(new Date().getHours())},{" "}
          <span className="font-semibold text-zinc-200">{current.name}</span>
        </p>
        <h1 className="text-xl font-bold tracking-tight">Como estão seus hábitos hoje?</h1>
      </div>

      {/* Cartão de pontos */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/20 via-card to-cyan-500/10 p-5">
        <Sparkles className="absolute -right-4 -top-4 h-24 w-24 text-violet-500/10" />
        <div className="flex items-end justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Star className="h-3.5 w-3.5 text-violet-400" /> Saldo de pontos
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-zinc-50">
              {current.points_balance.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400">Pontos hoje</p>
            <p className="text-lg font-bold text-violet-300">
              +{myTotals.totalPointsToday}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {current.total_points_earned.toLocaleString("pt-BR")} pontos ganhos no total
        </p>
      </div>

      {/* Progresso do dia */}
      <div className="space-y-3">
        <HabitCard
          title="Água"
          icon={Droplet}
          accent="water"
          value={myTotals.waterMl}
          target={DAILY_TARGETS.water}
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
          target={DAILY_TARGETS.exercise}
          unit="min"
          percent={myTotals.exercisePercent}
          points={myTotals.exercisePoints}
          capReached={myTotals.exerciseCapped}
          doneLabel={exerciseLabel}
        />
        <HabitCard
          title="Nutrição"
          icon={Apple}
          accent="nutrition"
          value={myTotals.nutritionDone.length}
          target={DAILY_TARGETS.nutrition}
          unit="check-ins"
          percent={myTotals.nutritionPercent}
          points={myTotals.nutritionPoints}
          capReached={myTotals.nutritionDone.length >= DAILY_TARGETS.nutrition}
          doneLabel={nutritionLabel}
        />
      </div>

      <Leaderboard
        entries={profiles.map((profile, index) => ({
          profile,
          todayPoints: totalsByUser[index]?.totalPointsToday ?? 0,
        }))}
      />
    </div>
  );
}
