"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";

export interface ActivateMissionResult {
  ok: boolean;
  error?: string;
}

/**
 * Ativa manualmente uma missão disponível ('available').
 * Missões sempre ativas (água) não precisam de ativação.
 */
export async function activateMissionAction(missionId: string): Promise<ActivateMissionResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) {
      return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };
    }

    const { data, error } = await supabaseAdmin.rpc("activate_mission", {
      p_user_id: profileId,
      p_mission_id: missionId,
    });

    if (error) {
      console.error("activateMissionAction: rpc error", error);
      return { ok: false, error: "Não foi possível ativar a missão." };
    }

    const result = data as unknown as { ok: boolean; error?: string };
    if (!result.ok) {
      const message =
        result.error === "missao_nao_encontrada"
          ? "Missão não encontrada."
          : result.error === "missao_inativa"
            ? "Está missão está inativa."
            : result.error === "missao_sempre_ativa"
              ? "Está missão fica sempre ativa e dispensa ativação."
              : result.error === "missao_em_curso"
                ? "Esta missão já está em andamento."
                : "Não foi possível ativar a missão.";
      return { ok: false, error: message };
    }

    revalidatePath("/missions");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    console.error("activateMissionAction", e);
    return { ok: false, error: "Erro inesperado ao ativar a missão." };
  }
}