import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getSessionProfileId } from "@/lib/session";
import { getExerciseTypes, getLogsForRange, getMealLogsForRange } from "@/lib/data";
import { HistoryView } from "@/components/history/history-view";
import { dateKeyInTimeZone, dayStartToUtc } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profileId = await getSessionProfileId();
  if (!profileId) redirect("/select-profile");

  const params = await searchParams;
  const nowKey = dateKeyInTimeZone();
  let year = Number(nowKey.slice(0, 4));
  let month = Number(nowKey.slice(5, 7)); // 1-based

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [py, pm] = params.month.split("-").map(Number);
    if (py >= 2000 && py <= 2100 && pm >= 1 && pm <= 12) {
      year = py;
      month = pm;
    }
  }

  const from = dayStartToUtc(`${year}-${pad(month)}-01`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const to = dayStartToUtc(`${nextYear}-${pad(nextMonth)}-01`);

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [logs, mealLogs, exerciseTypes] = await Promise.all([
    getLogsForRange(profileId, from, to),
    getMealLogsForRange(profileId, from, to),
    getExerciseTypes(),
  ]);

  // Resumo dos pratos por refeição ("Frango + Arroz + Salada").
  const mealSummaries: Record<string, string> = {};
  for (const meal of mealLogs) {
    if (meal.is_quick) continue;
    const names = (meal.meal_log_items ?? [])
      .map((item) => item.food_item?.name ?? item.custom_name)
      .filter((n): n is string => Boolean(n));
    const shown = names.slice(0, 3).join(" + ");
    mealSummaries[meal.id] = names.length > 3 ? `${shown} +${names.length - 3}` : shown;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Histórico</h1>
          <p className="text-sm text-muted">Veja o que você fez em cada dia.</p>
        </div>
        <a
          href="/api/export"
          download
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-fg-2 transition-colors hover:bg-raised"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </a>
      </div>

      <HistoryView
        year={year}
        month={month}
        monthLabel={`${MONTH_NAMES[month - 1]} ${year}`}
        logs={logs}
        exerciseTypes={exerciseTypes}
        mealSummaries={mealSummaries}
        prevMonth={`${prevYear}-${pad(prevMonth)}`}
        nextMonth={`${nextYear}-${pad(nextMonth)}`}
      />
    </div>
  );
}
