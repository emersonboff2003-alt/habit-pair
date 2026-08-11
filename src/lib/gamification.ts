import type { Log, LogType, NutritionCategory } from "@/types/database";

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
  nutrition: 3,
} as const;

export const NUTRITION_CATEGORIES: NutritionCategory[] = ["macros", "sweets", "meals"];

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
  nutritionDone: NutritionCategory[];
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
  const nutritionDone = new Set<NutritionCategory>();

  for (const log of logs) {
    if (log.type === "water") waterMl += log.value;
    else if (log.type === "exercise") exerciseMin += log.value;
    else if (
      log.type === "nutrition" &&
      (log.description === "macros" || log.description === "sweets" || log.description === "meals")
    ) {
      nutritionDone.add(log.description as NutritionCategory);
    }
  }

  const waterPoints = Math.min(
    calcPointsForLog("water", waterMl),
    DAILY_LIMITS.water.dailyCapPoints,
  );
  const exercisePoints = Math.min(
    calcPointsForLog("exercise", exerciseMin),
    DAILY_LIMITS.exercise.dailyCapPoints,
  );
  const nutritionPoints = [...nutritionDone].reduce(
    (sum, cat) => sum + NUTRITION_LABELS[cat].points,
    0,
  );

  return {
    waterMl,
    exerciseMin,
    nutritionDone: [...nutritionDone],
    waterPoints,
    exercisePoints,
    nutritionPoints,
    totalPointsToday: waterPoints + exercisePoints + nutritionPoints,
    waterPercent: Math.min(100, Math.round((waterMl / DAILY_TARGETS.water) * 100)),
    exercisePercent: Math.min(100, Math.round((exerciseMin / DAILY_TARGETS.exercise) * 100)),
    nutritionPercent: Math.min(100, Math.round((nutritionDone.size / DAILY_TARGETS.nutrition) * 100)),
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
