import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ExerciseType,
  FoodItem,
  Log,
  MealLog,
  MealLogWithItems,
  Mission,
  Profile,
  RedemptionWithReward,
  ReminderSettings,
  Reward,
  UserMissionWithMission,
} from "@/types/database";

/** Início do dia (fuso local) como timestamp UTC para consultas TIMESTAMPTZ. */
export function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("getProfiles", error);
    return [];
  }
  return data ?? [];
}

/**
 * Perfis em ordem alfabética. Revalidate curto: o saldo de pontos muda com
 * frequência, mas esta camada só evita queries repetidas num curto espaço.
 */
export const getProfiles = cache(() =>
  unstable_cache(fetchProfiles, ["getProfiles"], { revalidate: 15 })(),
);

async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();

  if (error) {
    console.error("getProfileById", error);
    return null;
  }
  return data;
}

export const getProfileById = cache((id: string) =>
  unstable_cache(fetchProfileById, ["getProfileById", id], { revalidate: 15 })(id),
);

/** Logs do dia atual do usuário (deduplicado por request). */
export const getTodayLogs = cache(async (profileId: string): Promise<Log[]> => {
  const { data, error } = await supabaseAdmin
    .from("logs")
    .select("*")
    .eq("user_id", profileId)
    .gte("created_at", startOfToday())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getTodayLogs", error);
    return [];
  }
  return data ?? [];
});

/** Histórico recente de logs do usuário. */
export const getRecentLogs = cache(async (profileId: string, limit = 20): Promise<Log[]> => {
  const { data, error } = await supabaseAdmin
    .from("logs")
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentLogs", error);
    return [];
  }
  return data ?? [];
});

/**
 * Missões do usuário (individuais) + missões cooperativas, com detalhes.
 * Ordenadas: em andamento primeiro, depois concluídas/falhas.
 * O progresso muda a cada registro; o cache apenas evita refetch no mesmo
 * request/render (layout + página chamam em duplicidade).
 */
export const getUserMissions = cache(async (profileId: string): Promise<UserMissionWithMission[]> => {
  const { data, error } = await supabaseAdmin
    .from("user_missions")
    .select("*, mission:missions(*)")
    .or(`user_id.eq.${profileId},user_id.is.null`)
    .order("status", { ascending: true });

  if (error) {
    console.error("getUserMissions", error);
    return [];
  }
  return (data ?? []) as unknown as UserMissionWithMission[];
});

async function fetchRewards(): Promise<Reward[]> {
  const { data, error } = await supabaseAdmin
    .from("rewards")
    .select("*")
    .order("cost_points", { ascending: true });

  if (error) {
    console.error("getRewards", error);
    return [];
  }
  return data ?? [];
}

/** Catálogo de recompensas — estático, cacheado por 60s. */
export const getRewards = cache(() =>
  unstable_cache(fetchRewards, ["getRewards"], { revalidate: 60 })(),
);

async function fetchActiveMissions(): Promise<Mission[]> {
  const { data, error } = await supabaseAdmin
    .from("missions")
    .select("*")
    .eq("is_active", true)
    .order("reward_points", { ascending: false });

  if (error) {
    console.error("getActiveMissions", error);
    return [];
  }
  return data ?? [];
}

export const getActiveMissions = cache(() =>
  unstable_cache(fetchActiveMissions, ["getActiveMissions"], { revalidate: 300 })(),
);

async function fetchFoodItems(): Promise<FoodItem[]> {
  const { data, error } = await supabaseAdmin
    .from("food_items")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getFoodItems", error);
    return [];
  }
  return (data ?? []) as FoodItem[];
}

/** Catálogo de alimentos — estático, cacheado por 300s. */
export const getFoodItems = cache(() =>
  unstable_cache(fetchFoodItems, ["getFoodItems"], { revalidate: 300 })(),
);

async function fetchExerciseTypes(): Promise<ExerciseType[]> {
  const { data, error } = await supabaseAdmin
    .from("exercise_types")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("getExerciseTypes", error);
    return [];
  }
  return (data ?? []) as ExerciseType[];
}

/** Modalidades de exercício — estático, cacheado por 300s. */
export const getExerciseTypes = cache(() =>
  unstable_cache(fetchExerciseTypes, ["getExerciseTypes"], { revalidate: 300 })(),
);

/** Refeições registradas hoje (para marcar o estado dos horários no painel). */
export const getTodayMealLogs = cache(async (profileId: string): Promise<MealLog[]> => {
  const { data, error } = await supabaseAdmin
    .from("meal_logs")
    .select("*")
    .eq("user_id", profileId)
    .gte("created_at", startOfToday())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getTodayMealLogs", error);
    return [];
  }
  return (data ?? []) as MealLog[];
});

/** Últimas refeições com os itens (para o resumo "Almoço · Frango+Arroz+Salada"). */
export const getRecentMealLogs = cache(
  async (profileId: string, limit = 15): Promise<MealLogWithItems[]> => {
    const { data, error } = await supabaseAdmin
      .from("meal_logs")
      .select("*, meal_log_items:meal_log_items(*, food_item:food_items(name))")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("getRecentMealLogs", error);
      return [];
    }
    return (data ?? []) as unknown as MealLogWithItems[];
  },
);

/** Preferências de lembretes do perfil (para o painel de notificações). */
export const getReminderSettings = cache(
  async (profileId: string): Promise<ReminderSettings | null> => {
    const { data, error } = await supabaseAdmin
      .from("reminder_settings")
      .select("*")
      .eq("user_id", profileId)
      .maybeSingle<ReminderSettings>();

    if (error) {
      console.error("getReminderSettings", error);
      return null;
    }
    if (!data) return null;

    // O Postgres devolve TIME como "HH:MM:SS"; o app usa "HH:MM". Normaliza.
    const normalizeTime = (value: string | null | undefined): string =>
      value && /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? value.slice(0, 5) : value ?? "";

    return {
      ...data,
      water_times: (data.water_times ?? []).map(normalizeTime).filter(Boolean),
      meal_breakfast: normalizeTime(data.meal_breakfast),
      meal_lunch: normalizeTime(data.meal_lunch),
      meal_afternoon: normalizeTime(data.meal_afternoon),
      meal_dinner: normalizeTime(data.meal_dinner),
      exercise_time: normalizeTime(data.exercise_time),
    };
  },
);

export const getRedemptions = cache(async (profileId: string): Promise<RedemptionWithReward[]> => {
  const { data, error } = await supabaseAdmin
    .from("redemptions")
    .select("*, reward:rewards(*)")
    .eq("user_id", profileId)
    .order("redeemed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getRedemptions", error);
    return [];
  }
  return (data ?? []) as unknown as RedemptionWithReward[];
});