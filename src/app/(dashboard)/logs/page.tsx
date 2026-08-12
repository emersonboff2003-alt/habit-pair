import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionProfileId } from "@/lib/session";
import { LogsPanel } from "@/components/logs/logs-panel";
import { LogsSkeleton } from "@/components/logs/logs-skeleton";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Registrar</h1>
        <p className="text-sm text-muted">Toque para registrar seus hábitos de hoje.</p>
      </div>

      <Suspense fallback={<LogsSkeleton />}>
        <LogsPanel profileId={profileId} />
      </Suspense>
    </div>
  );
}