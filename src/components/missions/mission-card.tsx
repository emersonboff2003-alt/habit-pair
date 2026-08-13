import { Droplet, Dumbbell, Apple, Users, Clock, Sparkles, Hourglass } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { LogType, MissionStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { ActivateMissionButton } from "@/components/missions/activate-mission-button";
import { DeleteMissionButton } from "@/components/missions/delete-mission-button";

interface MissionCardProps {
  missionId: string;
  title: string;
  description: string | null;
  targetType: LogType;
  currentProgress: number;
  targetValue: number;
  rewardPoints: number;
  isCooperative: boolean;
  status: MissionStatus;
  durationDays: number;
  isTemporary?: boolean;
  availableUntil?: string | null;
}

const typeConfig: Record<LogType, { icon: typeof Droplet; color: string; bar: string; unit: string }> = {
  water: { icon: Droplet, color: "text-cyan-300 bg-cyan-500/15", bar: "bg-cyan-400", unit: "ml" },
  exercise: { icon: Dumbbell, color: "text-amber-300 bg-amber-500/15", bar: "bg-amber-400", unit: "min" },
  nutrition: { icon: Apple, color: "text-emerald-300 bg-emerald-500/15", bar: "bg-emerald-400", unit: "check-ins" },
};

const statusConfig: Record<MissionStatus, { label: string; variant: "success" | "warning" | "muted" }> = {
  available: { label: "Disponível", variant: "muted" },
  in_progress: { label: "Em andamento", variant: "muted" },
  completed: { label: "Concluída", variant: "success" },
  failed: { label: "Não cumprida", variant: "warning" },
};

function formatAvailableUntil(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}/${month} às ${hours}:${minutes}`;
}

export function MissionCard({
  missionId,
  title,
  description,
  targetType,
  currentProgress,
  targetValue,
  rewardPoints,
  isCooperative,
  status,
  durationDays,
  isTemporary = false,
  availableUntil = null,
}: MissionCardProps) {
  const type = typeConfig[targetType];
  const Icon = type.icon;
  const statusInfo = statusConfig[status];
  const percent = Math.min(100, Math.round((currentProgress / targetValue) * 100));
  const done = status === "completed";
  const failed = status === "failed";
  const available = status === "available";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 transition-opacity",
        done ? "border-emerald-500/30" : failed ? "border-border opacity-70" : "border-border",
        available && "border-dashed",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", type.color)}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          <DeleteMissionButton missionId={missionId} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isTemporary && (
          <Badge variant="points">
            <Sparkles className="h-3 w-3" /> Temporária
          </Badge>
        )}
        {isCooperative && (
          <Badge variant="points">
            <Users className="h-3 w-3" /> Cooperativa
          </Badge>
        )}
        <Badge variant="muted">
          <Clock className="h-3 w-3" /> {durationDays} dia{durationDays > 1 ? "s" : ""}
        </Badge>
        <Badge variant="points" className="ml-auto">
          +{rewardPoints} pts
        </Badge>
      </div>

      {available ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted">
            {isTemporary && availableUntil ? (
              <span className="inline-flex items-center gap-1">
                <Hourglass className="h-3.5 w-3.5 shrink-0" />
                Disponibilidade até {formatAvailableUntil(availableUntil)}
              </span>
            ) : (
              "Ative para começar a valer pontos."
            )}
          </p>
          <ActivateMissionButton missionId={missionId} />
        </div>
      ) : (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">
              {currentProgress.toLocaleString("pt-BR")} / {targetValue.toLocaleString("pt-BR")} {type.unit}
            </span>
            <span className={done ? "font-semibold text-emerald-300" : "font-semibold text-fg-2"}>
              {percent}%
            </span>
          </div>
          <Progress value={percent} indicatorClassName={done ? "bg-emerald-400" : type.bar} />
        </div>
      )}
    </div>
  );
}