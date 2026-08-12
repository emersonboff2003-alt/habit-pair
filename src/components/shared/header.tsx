import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Profile, ReminderSettings } from "@/types/database";
import { ProfileSwitcher } from "@/components/shared/profile-switcher";
import { InstallPwaButton } from "@/components/shared/install-pwa-button";
import { ThemePicker } from "@/components/shared/theme-picker";
import { NotificationSettings } from "@/components/shared/notification-settings";

interface HeaderProps {
  current: Profile;
  profiles: Profile[];
  reminderSettings: ReminderSettings | null;
}

export function Header({ current, profiles, reminderSettings }: HeaderProps) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
        <Link href="/" prefetch className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2">
            <Sparkles className="h-4 w-4 text-zinc-950" />
          </span>
          <span className="text-base font-bold tracking-tight">
            Habit<span className="text-accent">Pair</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <NotificationSettings settings={reminderSettings} />
          <ThemePicker current={current.theme} />
          <InstallPwaButton />
          <ProfileSwitcher current={current} profiles={profiles} />
        </div>
      </div>
    </header>
  );
}
