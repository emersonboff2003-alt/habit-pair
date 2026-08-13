"use client";

import { useState, useSyncExternalStore } from "react";
import { Sparkles, Droplet, Target, Trophy, Gift } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "habit-pair-onboarded";

const ITEMS = [
  { icon: Droplet, text: "Registre água, exercício e refeições para ganhar pontos." },
  { icon: Target, text: "Complete missões (individuais e em dupla) para valer pontos extras." },
  { icon: Trophy, text: "Compare o progresso no placar de hoje, semana e mês." },
  { icon: Gift, text: "Troque seus pontos por recompensas na loja." },
];

const emptySubscribe = () => () => {};

function getSeenSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

// No servidor (SSR), assume já visto para não renderizar o diálogo durante a
// pré-renderização. No cliente, o valor real vem de getSeenSnapshot.
const getServerSnapshot = () => true;

export function Onboarding() {
  const seen = useSyncExternalStore(emptySubscribe, getSeenSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  const open = !seen && !dismissed;

  function handleStart() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* armazenamento indisponível: mostra de novo na próxima vez */
    }
    setDismissed(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent>
        <DialogHeader>
          <span className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 shadow-lg shadow-accent/25">
            <Sparkles className="h-7 w-7 text-zinc-950" />
          </span>
          <DialogTitle>Bem-vindo ao Habit Pair</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {ITEMS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised">
                <Icon className="h-4 w-4 text-accent" />
              </span>
              <p className="text-sm text-fg-2">{text}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          Cada perfil tem seus próprios pontos, temas e metas. Boa sorte para o casal!
        </p>

        <Button type="button" onClick={handleStart}>
          Começar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
