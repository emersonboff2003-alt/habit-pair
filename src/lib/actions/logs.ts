"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";
import { validateLogValue } from "@/lib/gamification";
import type {
  AddLogInput,
  AddLogResult,
  Log,
  LogType,
  UserMissionWithMission,
} from "@/types/database";

const NUTRITION_CATEGORIES = ["macros", "sweets", "meals"];

/**
 * Registra um novo log. O trigger `handle_log_insert` calcula os pontos
 * (respeitando tetos diários), aplica regras de nutrição e atualiza o
 * progresso das missões, creditando pontos ao completá-las.
 */
export async function addLogAction(input: AddLogInput): Promise<AddLogResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente.", pointsEarned: 0 };

    const { type, value, description } = input;

    if (!["water", "exercise", "nutrition"].includes(type as string)) {
      return { ok: false, error: "Tipo de registro inválido.", pointsEarned: 0 };
    }

    const validationError = validateLogValue(type as LogType, value);
    if (validationError) {
      return { ok: false, error: validationError, pointsEarned: 0 };
    }

    if (type === "nutrition") {
      if (!description || !NUTRITION_CATEGORIES.includes(description)) {
        return { ok: false, error: "Categoria nutricional inválida.", pointsEarned: 0 };
      }
    }

    // Janela para detectar missões concluídas por esta inserção.
    const before = new Date(Date.now() - 15000).toISOString();

    const { data: inserted, error } = await supabaseAdmin
      .from("logs")
      .insert({
        user_id: profileId,
        type: type as LogType,
        value,
        description: type === "nutrition" ? description : null,
      })
      .select("*")
      .single<Log>();

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("nutricao_duplicada") || message.includes("já registrado")) {
        return { ok: false, error: "Este check-in nutricional já foi feito hoje.", pointsEarned: 0 };
      }
      console.error("addLogAction: insert error", error);
      return { ok: false, error: "Não foi possível salvar o registro.", pointsEarned: 0 };
    }

    // Missões concluídas por este log (individuais + cooperativas).
    let completedMissionTitles: string[] | undefined;
    const { data: completedMissions, error: missionError } = await supabaseAdmin
      .from("user_missions")
      .select("*, missions(title)")
      .eq("status", "completed")
      .or(`user_id.eq.${profileId},user_id.is.null`)
      .gte("completed_at", before);

    if (!missionError && completedMissions) {
      const titles = (completedMissions as unknown as UserMissionWithMission[])
        .map((um) => um.mission?.title)
        .filter((t): t is string => Boolean(t));
      if (titles.length > 0) completedMissionTitles = titles;
    }

    revalidatePath("/");
    revalidatePath("/logs");
    revalidatePath("/missions");

    return { ok: true, pointsEarned: inserted.points_earned, completedMissionTitles };
  } catch (e) {
    console.error("addLogAction", e);
    return { ok: false, error: "Erro inesperado ao salvar o registro.", pointsEarned: 0 };
  }
}
