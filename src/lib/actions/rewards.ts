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
