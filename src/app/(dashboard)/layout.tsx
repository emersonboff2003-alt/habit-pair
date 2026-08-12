import { redirect } from "next/navigation";
import { Header } from "@/components/shared/header";
import { BottomNav } from "@/components/shared/bottom-nav";
import { ThemeSetter } from "@/components/shared/theme-setter";
import { ThemeSync } from "@/components/shared/theme-sync";
import { getSessionProfileId } from "@/lib/session";
import { getProfileById, getProfiles, getReminderSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const [current, profiles, reminderSettings] = await Promise.all([
    getProfileById(profileId),
    getProfiles(),
    getReminderSettings(profileId),
  ]);
  if (!current) redirect("/select-profile");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <ThemeSetter theme={current.theme} />
      <ThemeSync theme={current.theme} />
      <Header current={current} profiles={profiles} reminderSettings={reminderSettings} />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
