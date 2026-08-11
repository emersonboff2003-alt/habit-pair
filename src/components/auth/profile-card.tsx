"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { selectProfileAction } from "@/lib/actions/session";
import type { Profile } from "@/types/database";
import { initials } from "@/lib/utils";

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSelect() {
    setError(null);
    startTransition(async () => {
      const result = await selectProfileAction(profile.id);
      if (!result.ok) setError(result.error ?? "Não foi possível entrar.");
    });
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleSelect}
        disabled={pending}
        className="group flex w-24 flex-col items-center gap-2"
        aria-label={`Entrar como ${profile.name}`}
      >
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-gradient-to-br from-accent to-accent-2 text-2xl font-bold text-zinc-950 transition-all group-hover:scale-105 group-hover:border-accent group-active:scale-95 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-7 w-7 animate-spin text-background" />
          ) : (
            initials(profile.name)
          )}
        </span>
        <span className="text-sm font-semibold text-foreground">{profile.name}</span>
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
