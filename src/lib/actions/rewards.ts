"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";
import type { RedeemRewardResult, RedeemRewardRpcResult } from "@/types/database";

/**
 * Resgata uma recompensa. A dedução do saldo e a criação do resgate ocorrem
 * de forma atômica na função RPC `redeem_reward` do Postgres.
 */
export async function redeemRewardAction(rewardId: string): Promise<RedeemRewardResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    if (!rewardId) return { ok: false, error: "Recompensa inválida." };

    const { data, error } = await supabaseAdmin.rpc("redeem_reward", {
      p_user_id: profileId,
      p_reward_id: rewardId,
    });

    if (error) {
      console.error("redeemRewardAction: rpc error", error);
      return { ok: false, error: "Não foi possível realizar o resgate." };
    }

    const result = data as unknown as RedeemRewardRpcResult;
    if (!result.ok) {
      const message =
        result.error === "insufficient_points"
          ? "Pontos insuficientes para esta recompensa."
          : result.error === "reward_not_found"
            ? "Recompensa não encontrada."
            : "Não foi possível realizar o resgate.";
      return { ok: false, error: message };
    }

    revalidatePath("/");
    revalidatePath("/store");

    return { ok: true, newBalance: result.new_balance };
  } catch (e) {
    console.error("redeemRewardAction", e);
    return { ok: false, error: "Erro inesperado ao resgatar a recompensa." };
  }
}

/** Cria uma nova recompensa no catálogo (compartilhada entre os perfis). */
export async function addRewardAction(
  title: string,
  description: string,
  cost: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length > 100) {
      return { ok: false, error: "Informe um título válido (máx. 100 caracteres)." };
    }
    if (!Number.isInteger(cost) || cost <= 0) {
      return { ok: false, error: "Informe um custo em pontos válido." };
    }

    const { error } = await supabaseAdmin.from("rewards").insert({
      title: trimmedTitle,
      description: description.trim() || null,
      cost_points: cost,
      created_by: profileId,
    });

    if (error) {
      console.error("addRewardAction: insert error", error);
      return { ok: false, error: "Não foi possível criar a recompensa." };
    }

    revalidatePath("/store");
    return { ok: true };
  } catch (e) {
    console.error("addRewardAction", e);
    return { ok: false, error: "Erro inesperado ao criar a recompensa." };
  }
}

/** Remove uma recompensa do catálogo. */
export async function deleteRewardAction(rewardId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    if (!rewardId) return { ok: false, error: "Recompensa inválida." };

    const { error } = await supabaseAdmin.from("rewards").delete().eq("id", rewardId);

    if (error) {
      console.error("deleteRewardAction: delete error", error);
      return { ok: false, error: "Não foi possível remover a recompensa." };
    }

    revalidatePath("/store");
    return { ok: true };
  } catch (e) {
    console.error("deleteRewardAction", e);
    return { ok: false, error: "Erro inesperado ao remover a recompensa." };
  }
}
