import { redirect } from "next/navigation";
import { Target, CheckCircle2, XCircle } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getUserMissions } from "@/lib/data";
import { MissionCard } from "@/components/missions/mission-card";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const missions = await getUserMissions(profileId);
  const withMission = missions.filter((um) => um.mission !== null && um.mission.is_active);

  const inProgress = withMission.filter((um) => um.status === "in_progress");
  const completed = withMission.filter((um) => um.status === "completed");
  const failed = withMission.filter((um) => um.status === "failed");

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Missões</h1>
        <p className="text-sm text-muted">
          Complete metas para ganhar pontos. Missões cooperativas somam os esforços do casal.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Em andamento</h2>
        </div>
        {inProgress.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma missão em andamento.</p>
        ) : (
          inProgress.map((um) => (
            <MissionCard
              key={um.id}
              title={um.mission!.title}
              description={um.mission!.description}
              targetType={um.mission!.target_type}
              currentProgress={um.current_progress}
              targetValue={um.mission!.target_value}
              rewardPoints={um.mission!.reward_points}
              isCooperative={um.mission!.is_cooperative}
              status={um.status}
              durationDays={um.mission!.duration_days}
            />
          ))
        )}
      </section>

      {completed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Concluídas</h2>
          </div>
          {completed.map((um) => (
            <MissionCard
              key={um.id}
              title={um.mission!.title}
              description={um.mission!.description}
              targetType={um.mission!.target_type}
              currentProgress={um.current_progress}
              targetValue={um.mission!.target_value}
              rewardPoints={um.mission!.reward_points}
              isCooperative={um.mission!.is_cooperative}
              status={um.status}
              durationDays={um.mission!.duration_days}
            />
          ))}
        </section>
      )}

      {failed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold">Não cumpridas</h2>
          </div>
          {failed.map((um) => (
            <MissionCard
              key={um.id}
              title={um.mission!.title}
              description={um.mission!.description}
              targetType={um.mission!.target_type}
              currentProgress={um.current_progress}
              targetValue={um.mission!.target_value}
              rewardPoints={um.mission!.reward_points}
              isCooperative={um.mission!.is_cooperative}
              status={um.status}
              durationDays={um.mission!.duration_days}
            />
          ))}
        </section>
      )}
    </div>
  );
}
