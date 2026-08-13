"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { selectProfileAction } from "@/lib/actions/session";
import { EditProfileDialog } from "@/components/auth/edit-profile-dialog";
import { DeleteProfileButton } from "@/components/auth/delete-profile-button";
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
    <div className="w-full">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <button
          type="button"
          onClick={handleSelect}
          disabled={pending}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Entrar como ${profile.name}`}
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-border bg-gradient-to-br from-accent to-accent-2 text-lg font-bold text-zinc-950 transition-all group-hover:border-accent group-active:scale-95 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin text-background" />
            ) : (
              initials(profile.name)
            )}
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {profile.name}
          </span>
        </button>

        <EditProfileDialog profileId={profile.id} name={profile.name} />
        <DeleteProfileButton profileId={profile.id} name={profile.name} />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
