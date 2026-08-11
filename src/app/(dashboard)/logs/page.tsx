import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getTodayLogs, getRecentLogs } from "@/lib/data";
import { QuickLogPanel } from "@/components/logs/quick-log-panel";
import { LogList } from "@/components/logs/log-list";
import type { NutritionCategory } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const [todayLogs, recentLogs] = await Promise.all([
    getTodayLogs(profileId),
    getRecentLogs(profileId, 20),
  ]);

  const nutritionDone = todayLogs
    .filter((l) => l.type === "nutrition" && !!l.description)
    .map((l) => l.description as NutritionCategory)
    .filter(
      (cat): cat is NutritionCategory =>
        cat === "macros" || cat === "sweets" || cat === "meals",
    );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Registrar</h1>
        <p className="text-sm text-muted">Toque para registrar seus hábitos de hoje.</p>
      </div>

      <QuickLogPanel nutritionDone={nutritionDone} />

      {todayLogs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold">Registros de hoje</h2>
          </div>
          <LogList logs={todayLogs.slice().reverse()} />
        </section>
      )}

      {recentLogs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold">Atividade recente</h2>
          </div>
          <LogList logs={recentLogs} />
        </section>
      )}
    </div>
  );
}
