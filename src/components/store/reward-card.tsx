"use client";

import { useState, useTransition } from "react";
import { Gift, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { redeemRewardAction } from "@/lib/actions/rewards";
import type { Reward } from "@/types/database";
import { cn } from "@/lib/utils";

interface RewardCardProps {
  reward: Reward;
  balance: number;
}

type DialogState = { status: "idle" | "pending" | "success" | "error"; message?: string };

export function RewardCard({ reward, balance }: RewardCardProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialogState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const affordable = balance >= reward.cost_points;

  function handleRedeem() {
    setState({ status: "pending" });
    startTransition(async () => {
      const result = await redeemRewardAction(reward.id);
      if (result.ok) {
        setState({ status: "success", message: "Resgate confirmado! O parceiro cumpre o prêmio." });
        setTimeout(() => setOpen(false), 1400);
      } else {
        setState({ status: "error", message: result.error });
      }
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border bg-card p-4",
        affordable ? "border-border" : "border-border opacity-60",
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
        <Gift className="h-6 w-6 text-violet-300" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{reward.title}</p>
        {reward.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{reward.description}</p>
        )}
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-bold text-violet-300">
          {reward.cost_points} pts
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="points"
            size="sm"
            disabled={!affordable}
            onClick={() => setState({ status: "idle" })}
          >
            Resgatar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar resgate</DialogTitle>
            <DialogDescription>
              Trocar <strong className="text-foreground">{reward.cost_points} pontos</strong> por{" "}
              <strong className="text-foreground">{reward.title}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-raised/60 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seu saldo</span>
              <span className="font-semibold">{balance} pts</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Custo</span>
              <span className="font-semibold text-red-300">-{reward.cost_points} pts</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1">
              <span className="text-muted-foreground">Saldo após</span>
              <span className="font-semibold text-violet-300">
                {Math.max(0, balance - reward.cost_points)} pts
              </span>
            </div>
          </div>

          {state.status === "success" && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {state.message}
            </p>
          )}
          {state.status === "error" && (
            <p className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <XCircle className="h-4 w-4 shrink-0" /> {state.message}
            </p>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              variant="points"
              className="flex-1"
              onClick={handleRedeem}
              disabled={pending || !affordable}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
