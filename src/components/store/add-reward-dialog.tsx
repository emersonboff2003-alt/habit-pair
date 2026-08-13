"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addRewardAction } from "@/lib/actions/rewards";

export function AddRewardDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTitle("");
      setDescription("");
      setCost("");
      setError(null);
    }
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await addRewardAction(title, description, Number(cost));
      if (res.ok) {
        setOpen(false);
      } else {
        setError(res.error ?? "Não foi possível criar a recompensa.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-fg-2 transition-colors hover:bg-raised"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova recompensa
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova recompensa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Título</span>
            <input
              type="text"
              value={title}
              maxLength={100}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Massagem de 30 minutos"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Descrição (opcional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Sessão oferecida pelo(a) parceiro(a)"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Custo (pontos)</span>
            <input
              type="number"
              min={1}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Ex.: 80"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={handleCreate}
            disabled={pending || !title.trim() || !Number(cost)}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar recompensa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
