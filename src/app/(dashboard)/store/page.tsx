import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getProfileById, getRewards, getRedemptions } from "@/lib/data";
import { RewardCard } from "@/components/store/reward-card";
import { RedemptionList } from "@/components/store/redemption-list";
import { AddRewardDialog } from "@/components/store/add-reward-dialog";
import { DeleteRewardButton } from "@/components/store/delete-reward-button";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const [current, rewards, redemptions] = await Promise.all([
    getProfileById(profileId),
    getRewards(),
    getRedemptions(profileId),
  ]);

  if (!current) redirect("/select-profile");

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Recompensas</h1>
        <p className="text-sm text-muted">
          Troque seus pontos por prêmios. Seu saldo:{" "}
          <span className="font-bold text-violet-300">
            {current.points_balance.toLocaleString("pt-BR")} pts
          </span>
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold">Loja</h2>
          <AddRewardDialog />
        </div>
        {rewards.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma recompensa cadastrada.</p>
        ) : (
          rewards.map((reward) => (
            <div key={reward.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <RewardCard reward={reward} balance={current.points_balance} />
              </div>
              <DeleteRewardButton rewardId={reward.id} />
            </div>
          ))
        )}
      </section>

      {redemptions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Meus resgates</h2>
          <RedemptionList redemptions={redemptions} />
        </section>
      )}
    </div>
  );
}
