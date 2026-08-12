import { redirect } from "next/navigation";
import { Target, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getUserMissions } from "@/lib/data";
import { MissionCard } from "@/components/missions/mission-card";
import type { UserMissionWithMission } from "@/types/database";

export const dynamic = "force-dynamic";

function CardFor({ um }: { um: UserMissionWithMission }) {
  const mission = um.mission!;
  return (
    <MissionCard
      missionId={mission.id}
      title={mission.title}
      description={mission.description}
      targetType={mission.target_type}
      currentProgress={um.current_progress}
      targetValue={mission.target_value}
      rewardPoints={mission.reward_points}
      isCooperative={mission.is_cooperative}
      status={um.status}
      durationDays={mission.duration_days}
      isTemporary={mission.is_temporary}
      availableUntil={um.available_until}
    />
  );
}

export default async function MissionsPage() {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const missions = await getUserMissions(profileId);
  const withMission = missions.filter((um) => um.mission !== null && um.mission.is_active);

  // Temporárias que sumiram (falharam/venceram) não aparecem: voltam aleatoriamente.
  const visible = withMission.filter(
    (um) => !(um.mission!.is_temporary && um.status === "failed"),
  );

  const inProgress = visible.filter((um) => um.status === "in_progress");
  const available = visible.filter((um) => um.status === "available");
  const completed = visible.filter((um) => um.status === "completed");
  const failed = visible.filter((um) => um.status === "failed");

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Missões</h1>
        <p className="text-sm text-muted">
          Ative as missões para começar a valer pontos. Água fica sempre ativa. Missões temporárias
          aparecem por alguns dias e voltam depois.
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
          inProgress.map((um) => <CardFor key={um.id} um={um} />)
        )}
      </section>

      {available.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <h2 className="text-sm font-semibold">Disponíveis</h2>
            <span className="text-xs text-muted">ative para começar</span>
          </div>
          {available.map((um) => (
            <CardFor key={um.id} um={um} />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Concluídas</h2>
          </div>
          {completed.map((um) => (
            <CardFor key={um.id} um={um} />
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
            <CardFor key={um.id} um={um} />
          ))}
        </section>
      )}
    </div>
  );
}