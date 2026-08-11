"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/lib/actions/session";
import type { Profile } from "@/types/database";
import { cn, initials } from "@/lib/utils";

interface ProfileSwitcherProps {
  current: Profile;
  profiles: Profile[];
}

export function ProfileSwitcher({ current, profiles }: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const others = profiles.filter((p) => p.id !== current.id);

  async function handleSwitch() {
    setPending(true);
    await logoutAction();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-card-hover"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-bold text-zinc-950">
          {initials(current.name)}
        </span>
        <span className="max-w-24 truncate text-sm font-semibold">{current.name}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-raised shadow-xl animate-pop">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs text-muted">Conectado como</p>
            <p className="text-sm font-semibold">{current.name}</p>
          </div>
          <div className="p-1.5">
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={handleSwitch}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-2 transition-colors hover:bg-raised disabled:opacity-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-bold text-zinc-950">
                  {initials(p.name)}
                </span>
                <span className="flex items-center gap-1.5">
                  Entrar como {p.name}
                  <UserRound className="h-3.5 w-3.5 text-muted" />
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleSwitch}
              disabled={pending}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-300 transition-colors hover:bg-red-950/40 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
