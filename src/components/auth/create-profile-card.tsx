"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createProfileAction } from "@/lib/actions/profiles";

export function CreateProfileCard() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName("");
      setError(null);
    }
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createProfileAction(name);
      if (res.ok) {
        setName("");
        setOpen(false);
      } else {
        setError(res.error ?? "Não foi possível criar o perfil.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card px-8 py-10 text-muted transition-colors hover:border-accent/50 hover:text-fg-2"
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-semibold">Adicionar perfil</span>
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Nome</span>
            <input
              type="text"
              value={name}
              maxLength={50}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !pending) handleCreate();
              }}
              placeholder="Ex.: Lucas"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <Button type="button" onClick={handleCreate} disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar perfil
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
