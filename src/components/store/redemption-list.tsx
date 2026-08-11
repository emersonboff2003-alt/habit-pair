import { Ticket } from "lucide-react";
import type { RedemptionWithReward } from "@/types/database";
import { formatDate } from "@/lib/utils";

export function RedemptionList({ redemptions }: { redemptions: RedemptionWithReward[] }) {
  return (
    <ul className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-card">
      {redemptions.map((redemption) => (
        <li key={redemption.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
            <Ticket className="h-4 w-4 text-violet-300" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">
              {redemption.reward?.title ?? "Recompensa"}
            </p>
            <p className="text-xs text-zinc-500">
              Resgatado em {formatDate(redemption.redeemed_at)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              redemption.status === "fulfilled"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {redemption.status === "fulfilled" ? "Cumprido" : "Pendente"}
          </span>
        </li>
      ))}
    </ul>
  );
}
