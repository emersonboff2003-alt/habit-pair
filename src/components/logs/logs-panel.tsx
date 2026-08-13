import { History } from "lucide-react";
import {
  getTodayLogs,
  getFoodItems,
  getExerciseTypes,
  getTodayMealLogs,
  getRecentMealLogs,
} from "@/lib/data";
import { QuickLogPanel } from "@/components/logs/quick-log-panel";
import { LogList } from "@/components/logs/log-list";

export async function LogsPanel({ profileId }: { profileId: string }) {
  const [todayLogs, foodItems, exerciseTypes, mealLogsToday, recentMealLogs] =
    await Promise.all([
      getTodayLogs(profileId),
      getFoodItems(),
      getExerciseTypes(),
      getTodayMealLogs(profileId),
      getRecentMealLogs(profileId),
    ]);

  const quickExerciseDone = todayLogs.some(
    (l) => l.type === "exercise" && l.description === "quick",
  );

  // Resumo dos pratos por refeição ("Frango + Arroz + Salada") para exibir na listagem.
  const mealSummaries: Record<string, string> = {};
  for (const meal of recentMealLogs) {
    if (meal.is_quick) continue;
    const names = (meal.meal_log_items ?? [])
      .map((item) => item.food_item?.name ?? item.custom_name)
      .filter((n): n is string => Boolean(n));
    const shown = names.slice(0, 3).join(" + ");
    mealSummaries[meal.id] =
      names.length > 3 ? `${shown} +${names.length - 3}` : shown;
  }

  return (
    <div className="space-y-6">
      <QuickLogPanel
        foodItems={foodItems}
        mealLogsToday={mealLogsToday}
        exerciseTypes={exerciseTypes}
        quickExerciseDone={quickExerciseDone}
      />

      {todayLogs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold">Registros de hoje</h2>
          </div>
          <LogList
            logs={todayLogs.slice().reverse()}
            exerciseTypes={exerciseTypes}
            mealSummaries={mealSummaries}
          />
        </section>
      )}
    </div>
  );
}