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

export interface CreateMissionInput {
  title: string;
  description?: string;
  targetType: "water" | "exercise" | "nutrition";
  targetValue: number;
  durationDays: number;
  rewardPoints: number;
  isCooperative: boolean;
}

/** Cria uma nova missão (individual ou cooperativa) via RPC create_mission. */
export async function createMissionAction(input: CreateMissionInput): Promise<ActivateMissionResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) {
      return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };
    }

    const { data, error } = await supabaseAdmin.rpc("create_mission", {
      p_title: input.title,
      p_description: input.description,
      p_target_type: input.targetType,
      p_target_value: input.targetValue,
      p_duration_days: input.durationDays,
      p_reward_points: input.rewardPoints,
      p_is_cooperative: input.isCooperative,
    });

    if (error) {
      console.error("createMissionAction: rpc error", error);
      return { ok: false, error: "Não foi possível criar a missão." };
    }

    const result = data as unknown as { ok: boolean; error?: string };
    if (!result.ok) {
      const message =
        result.error === "titulo_invalido"
          ? "Informe um título válido."
          : result.error === "meta_invalida"
            ? "Informe uma meta válida."
            : result.error === "duracao_invalida"
              ? "Duração deve ficar entre 1 e 30 dias."
              : result.error === "recompensa_invalida"
                ? "Informe uma recompensa em pontos válida."
                : "Não foi possível criar a missão.";
      return { ok: false, error: message };
    }

    revalidatePath("/missions");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    console.error("createMissionAction", e);
    return { ok: false, error: "Erro inesperado ao criar a missão." };
  }
}

/** Remove uma missão do catálogo (cascateia user_missions). */
export async function deleteMissionAction(missionId: string): Promise<ActivateMissionResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) {
      return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };
    }

    if (!missionId) return { ok: false, error: "Missão inválida." };

    const { error } = await supabaseAdmin.from("missions").delete().eq("id", missionId);

    if (error) {
      console.error("deleteMissionAction: delete error", error);
      return { ok: false, error: "Não foi possível remover a missão." };
    }

    revalidatePath("/missions");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    console.error("deleteMissionAction", e);
    return { ok: false, error: "Erro inesperado ao remover a missão." };
  }
}