import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";
import {
  LOG_TYPE_LABELS,
  MEAL_SLOT_LABELS,
  parseMealDescription,
} from "@/lib/gamification";
import { APP_TIME_ZONE, dateKeyForIso } from "@/lib/utils";

export const dynamic = "force-dynamic";

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function csvField(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function describeLog(log: {
  type: string;
  description: string | null;
}): string {
  if (log.type === "nutrition") {
    const meal = parseMealDescription(log.description);
    if (meal) return `Refeição (${MEAL_SLOT_LABELS[meal.slot]}${meal.isQuick ? " · rápida" : ""})`;
    return log.description ?? "";
  }
  if (log.type === "exercise") {
    if (log.description === "quick") return "Treino rápido";
    return log.description ?? "";
  }
  return "";
}

/** Exporta o histórico do perfil ativo em CSV. */
export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return new NextResponse("Sessão expirada. Selecione o perfil novamente.", { status: 401 });
  }

  const { data: logs, error } = await supabaseAdmin
    .from("logs")
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("api/export: query error", error);
    return new NextResponse("Erro ao gerar o CSV.", { status: 500 });
  }

  const header = ["data", "hora", "tipo", "valor", "pontos", "descrição"];
  const rows = (logs ?? []).map((log) => [
    dateKeyForIso(log.created_at),
    timeOf(log.created_at),
    LOG_TYPE_LABELS[log.type as keyof typeof LOG_TYPE_LABELS] ?? log.type,
    String(log.value),
    String(log.points_earned),
    describeLog(log),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="habit-pair-historico.csv"',
    },
  });
}
