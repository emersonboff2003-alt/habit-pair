import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Profile } from "@/types/database";
import { ProfileSwitcher } from "@/components/shared/profile-switcher";
import { InstallPwaButton } from "@/components/shared/install-pwa-button";
import { ThemePicker } from "@/components/shared/theme-picker";

interface HeaderProps {
  current: Profile;
  profiles: Profile[];
}

export function Header({ current, profiles }: HeaderProps) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2">
            <Sparkles className="h-4 w-4 text-zinc-950" />
          </span>
          <span className="text-base font-bold tracking-tight">
            Habit<span className="text-accent">Pair</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemePicker current={current.theme} />
          <InstallPwaButton />
          <ProfileSwitcher current={current} profiles={profiles} />
        </div>
      </div>
    </header>
  );
}
