import type { Log, LogType, MealSlot, NutritionCategory } from "@/types/database";

export const DAILY_LIMITS = {
  water: {
    unitMl: 500,
    pointsPerUnit: 10,
    dailyCapPoints: 50,
  },
  exercise: {
    pointsPerMinute: 1,
    dailyCapPoints: 90,
  },
  nutrition: {
    macros: 50,
    sweets: 30,
    meals: 20,
    dailyCapPoints: 100,
  },
} as const;

export const DAILY_TARGETS = {
  water: 2500,
  exercise: 90,
  nutrition: 4,
} as const;

export const NUTRITION_CATEGORIES: NutritionCategory[] = ["macros", "sweets", "meals"];

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "afternoon", "dinner"];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  afternoon: "Lanche da tarde",
  dinner: "Jantar",
};

/** Pontos fixos de uma refeição rápida (menos do que detalhar). */
export const QUICK_MEAL_POINTS = 10;

/** Quantidade mínima de itens para o bônus de "refeição completa". */
export const COMPLETE_MEAL_MIN_ITEMS = 3;

/** Bônus aplicado quando a refeição detalhada tem 3+ itens. */
export const COMPLETE_MEAL_BONUS = 10;

/** Pontos de um item livre (fora do catálogo). */
export const CUSTOM_ITEM_POINTS = 5;

/** Pontos fixos de um treino rápido (menos do que um treino detalhado). */
export const QUICK_EXERCISE_POINTS = 20;

/** Equivalência em minutos de um treino rápido para o progresso de missões. */
export const QUICK_EXERCISE_MIN_EQUIV = 30;

/** Categorias de alimentos, na ordem de exibição. */
export const FOOD_CATEGORY_LABELS: Record<string, string> = {
  grains: "Grãos e carboidratos",
  protein: "Proteínas",
  vegetables: "Legumes e verduras",
  fruits: "Frutas",
  dairy: "Laticínios",
  beverages: "Bebidas",
  sweets: "Doces e guloseimas",
  ready_meals: "Pratos prontos",
};

export const NUTRITION_LABELS: Record<NutritionCategory, { label: string; description: string; points: number }> = {
  macros: {
    label: "Metas calóricas/macros",
    description: "Bateu a meta de calorias e macros do dia",
    points: DAILY_LIMITS.nutrition.macros,
  },
  sweets: {
    label: "Limite de doces",
    description: "Ficou dentro do limite de doces/açúcar",
    points: DAILY_LIMITS.nutrition.sweets,
  },
  meals: {
    label: "Refeições registradas",
    description: "Registrou todas as refeições do dia",
    points: DAILY_LIMITS.nutrition.meals,
  },
};

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  water: "Água",
  exercise: "Exercício",
  nutrition: "Nutrição",
};

/**
 * Pontos brutos de um registro, sem considerar o teto diário.
 * Água: +10 a cada 500ml | Exercício: +1 por minuto | Nutrição: fixos por categoria.
 */
export function calcPointsForLog(type: LogType, value: number, description?: string | null): number {
  switch (type) {
    case "water":
      return Math.floor(value / DAILY_LIMITS.water.unitMl) * DAILY_LIMITS.water.pointsPerUnit;
    case "exercise":
      return Math.floor(value) * DAILY_LIMITS.exercise.pointsPerMinute;
    case "nutrition":
      if (description === "macros") return DAILY_LIMITS.nutrition.macros;
      if (description === "sweets") return DAILY_LIMITS.nutrition.sweets;
      if (description === "meals") return DAILY_LIMITS.nutrition.meals;
      return 0;
    default:
      return 0;
  }
}

/** Retorna o teto diário de pontos por tipo. */
export function dailyCapFor(type: LogType): number {
  switch (type) {
    case "water":
      return DAILY_LIMITS.water.dailyCapPoints;
    case "exercise":
      return DAILY_LIMITS.exercise.dailyCapPoints;
    case "nutrition":
      return DAILY_LIMITS.nutrition.dailyCapPoints;
    default:
      return 0;
  }
}

/**
 * Aplica o teto diário: os pontos do novo registro são cortados para que
 * o total do dia não ultrapasse o teto do tipo.
 */
export function applyDailyCap(type: LogType, alreadyEarnedToday: number, rawEarned: number): number {
  const cap = dailyCapFor(type);
  return Math.max(0, Math.min(rawEarned, cap - alreadyEarnedToday));
}

/**
 * Pontos efetivos de um registro dado o total já ganho hoje para aquele tipo.
 */
export function calcDailyPointsForLog(
  type: LogType,
  value: number,
  alreadyEarnedToday: number,
  description?: string | null,
): number {
  const raw = calcPointsForLog(type, value, description);
  return applyDailyCap(type, alreadyEarnedToday, raw);
}

/**
 * Valida um valor de registro. Retorna uma mensagem de erro ou null se válido.
 */
export function validateLogValue(type: LogType, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return "O valor precisa ser maior que zero.";
  }
  if (!Number.isInteger(value)) {
    return "O valor precisa ser um número inteiro.";
  }
  switch (type) {
    case "water":
      if (value > 5000) return "Registro de água acima de 5000ml não faz sentido.";
      return null;
    case "exercise":
      if (value > 600) return "Registro de treino acima de 600 minutos não faz sentido.";
      return null;
    case "nutrition":
      if (value !== 1) return "Check-in nutricional usa valor 1.";
      return null;
    default:
      return "Tipo de registro inválido.";
  }
}

export interface DayTotals {
  waterMl: number;
  exerciseMin: number;
  nutritionDone: MealSlot[];
  waterPoints: number;
  exercisePoints: number;
  nutritionPoints: number;
  totalPointsToday: number;
  waterPercent: number;
  exercisePercent: number;
  nutritionPercent: number;
  waterCapped: boolean;
  exerciseCapped: boolean;
}

/**
 * Calcula os totais do dia a partir dos logs do usuário (já filtrados por dia).
 * Os pontos respeitam o teto diário conforme as regras de gamificação.
 */
export function computeTodayTotals(logs: Log[]): DayTotals {
  let waterMl = 0;
  let exerciseMin = 0;
  const nutritionSlots = new Set<MealSlot>();

  for (const log of logs) {
    if (log.type === "water") {
      waterMl += log.value;
    } else if (log.type === "exercise") {
      exerciseMin += log.value;
    } else if (log.type === "nutrition") {
      const meal = parseMealDescription(log.description);
      if (meal) nutritionSlots.add(meal.slot);
    }
  }

  const waterPoints = logs
    .filter((l) => l.type === "water")
    .reduce((sum, l) => sum + l.points_earned, 0);
  const exercisePoints = logs
    .filter((l) => l.type === "exercise")
    .reduce((sum, l) => sum + l.points_earned, 0);
  const nutritionPoints = logs
    .filter((l) => l.type === "nutrition")
    .reduce((sum, l) => sum + l.points_earned, 0);

  const nutritionDone = MEAL_SLOTS.filter((slot) => nutritionSlots.has(slot));

  return {
    waterMl,
    exerciseMin,
    nutritionDone,
    waterPoints,
    exercisePoints,
    nutritionPoints,
    totalPointsToday: waterPoints + exercisePoints + nutritionPoints,
    waterPercent: Math.min(100, Math.round((waterMl / DAILY_TARGETS.water) * 100)),
    exercisePercent: Math.min(100, Math.round((exerciseMin / DAILY_TARGETS.exercise) * 100)),
    nutritionPercent: Math.min(100, Math.round((nutritionDone.length / DAILY_TARGETS.nutrition) * 100)),
    waterCapped: waterPoints >= DAILY_LIMITS.water.dailyCapPoints,
    exerciseCapped: exercisePoints >= DAILY_LIMITS.exercise.dailyCapPoints,
  };
}

/** Verifica se o teto diário de pontos de um tipo já foi atingido. */
export function isDailyCapReached(type: LogType, dayLogs: Log[]): boolean {
  const total = dayLogs
    .filter((l) => l.type === type)
    .reduce((sum, l) => sum + l.points_earned, 0);
  return total >= dailyCapFor(type);
}

/** Verifica se a categoria nutricional já foi registrada hoje. */
export function isNutritionSlotTaken(dayLogs: Log[], category: NutritionCategory): boolean {
  return dayLogs.some((l) => l.type === "nutrition" && l.description === category);
}

/**
 * Interpreta a description de um log de refeição ('meal:<slot>:<id>[:quick]').
 * Retorna null para descriptions que não são de refeição.
 */
export function parseMealDescription(
  description: string | null,
): { slot: MealSlot; mealLogId: string; isQuick: boolean } | null {
  if (!description || !description.startsWith("meal:")) return null;
  const [slot, mealLogId, flag] = description.slice(5).split(":");
  if (!isMealSlot(slot)) return null;
  return {
    slot,
    mealLogId: mealLogId ?? "",
    isQuick: flag === "quick",
  };
}

export function isMealSlot(value: string | null | undefined): value is MealSlot {
  return (
    value === "breakfast" ||
    value === "lunch" ||
    value === "afternoon" ||
    value === "dinner"
  );
}

export interface MealItemPreview {
  name: string;
  portion: number;
  points: number;
}

interface FoodLike {
  id: string;
  name: string;
  points: number;
}

/**
 * Calcula os pontos de uma refeição detalhada (preview e validação no cliente).
 * Espelha a lógica da RPC insert_meal_log do banco.
 */
export function calcDetailedMealPoints(
  items: { foodItemId?: string; customName?: string; portion?: number }[],
  catalog: FoodLike[],
): { points: number; itemCount: number; bonusApplied: boolean; items: MealItemPreview[] } {
  let points = 0;
  let itemCount = 0;
  const previews: MealItemPreview[] = [];

  for (const item of items) {
    const portion = Math.max(1, Math.floor(item.portion ?? 1));
    let itemPoints: number;
    let name: string;

    if (item.foodItemId) {
      const food = catalog.find((f) => f.id === item.foodItemId);
      if (!food) continue;
      itemPoints = food.points;
      name = food.name;
    } else {
      itemPoints = CUSTOM_ITEM_POINTS;
      name = item.customName?.trim() || "Item livre";
    }

    const total = itemPoints * portion;
    points += total;
    itemCount += 1;
    previews.push({ name, portion, points: total });
  }

  const bonusApplied = itemCount >= COMPLETE_MEAL_MIN_ITEMS;
  if (bonusApplied) points += COMPLETE_MEAL_BONUS;

  return { points, itemCount, bonusApplied, items: previews };
}
