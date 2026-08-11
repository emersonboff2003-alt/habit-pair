import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Log,
  Mission,
  Profile,
  RedemptionWithReward,
  Reward,
  UserMissionWithMission,
} from "@/types/database";

/** Início do dia (fuso local) como timestamp UTC para consultas TIMESTAMPTZ. */
export function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getProfiles(): Promise<Profile[]> {
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

export async function getProfileById(id: string): Promise<Profile | null> {
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

/** Logs do dia atual do usuário. */
export async function getTodayLogs(profileId: string): Promise<Log[]> {
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
}

/** Histórico recente de logs do usuário. */
export async function getRecentLogs(profileId: string, limit = 20): Promise<Log[]> {
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
}

/**
 * Missões do usuário (individuais) + missões cooperativas, com detalhes.
 * Ordenadas: em andamento primeiro, depois concluídas/falhas.
 */
export async function getUserMissions(profileId: string): Promise<UserMissionWithMission[]> {
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
}

export async function getRewards(): Promise<Reward[]> {
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

export async function getRedemptions(profileId: string): Promise<RedemptionWithReward[]> {
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
}

export async function getActiveMissions(): Promise<Mission[]> {
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
