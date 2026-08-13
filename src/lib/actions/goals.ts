"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";

type ActionResult = { ok: boolean; error?: string };

/**
 * Salva as metas diárias (água e exercício) do perfil ativo.
 */
export async function updateGoalsAction(
  waterMl: number,
  exerciseMin: number,
): Promise<ActionResult> {
  try {
    if (!Number.isInteger(waterMl) || waterMl < 500 || waterMl > 10000) {
      return { ok: false, error: "Meta de água deve ficar entre 500 e 10.000 ml." };
    }
    if (!Number.isInteger(exerciseMin) || exerciseMin < 5 || exerciseMin > 300) {
      return { ok: false, error: "Meta de exercício deve ficar entre 5 e 300 minutos." };
    }

    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ water_goal_ml: waterMl, exercise_goal_min: exerciseMin })
      .eq("id", profileId);

    if (error) {
      console.error("updateGoalsAction: update error", error);
      return { ok: false, error: "Não foi possível salvar as metas." };
    }

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("updateGoalsAction", e);
    return { ok: false, error: "Erro inesperado ao salvar as metas." };
  }
}
