"use client";

import { useState, useTransition } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "@/lib/actions/profiles";

interface EditProfileDialogProps {
  profileId: string;
  name: string;
}

export function EditProfileDialog({ profileId, name }: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValue(name);
      setError(null);
    }
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateProfileAction(profileId, value);
      if (res.ok) {
        setOpen(false);
      } else {
        setError(res.error ?? "Não foi possível renomear.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg-2"
          aria-label={`Editar ${name}`}
          title="Editar perfil"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-fg-2">Nome</span>
            <input
              type="text"
              value={value}
              maxLength={50}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim() && !pending) handleSave();
              }}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <Button type="button" onClick={handleSave} disabled={pending || !value.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
