// =============================================================================
// Tipos manuais do Supabase (equivalente a `supabase gen types`)
// =============================================================================

export type LogType = "water" | "exercise" | "nutrition";
export type MissionStatus = "in_progress" | "completed" | "failed";
export type RewardStatus = "available" | "redeemed" | "fulfilled";
export type NutritionCategory = "macros" | "sweets" | "meals";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// -----------------------------------------------------------------------------
// Linhas
// -----------------------------------------------------------------------------

export type Profile = {
  id: string;
  name: string;
  pin_hash: string | null;
  points_balance: number;
  total_points_earned: number;
  theme: string;
  created_at: string;
}

export type Log = {
  id: string;
  user_id: string;
  type: LogType;
  value: number;
  points_earned: number;
  description: string | null;
  created_at: string;
}

export type Mission = {
  id: string;
  title: string;
  description: string | null;
  target_type: LogType;
  target_value: number;
  duration_days: number;
  reward_points: number;
  is_cooperative: boolean;
  is_active: boolean;
  created_at: string;
}

export type UserMission = {
  id: string;
  user_id: string | null;
  mission_id: string;
  current_progress: number;
  status: MissionStatus;
  started_at: string;
  completed_at: string | null;
}

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  cost_points: number;
  created_by: string | null;
  created_at: string;
}

export type Redemption = {
  id: string;
  reward_id: string;
  user_id: string;
  status: RewardStatus;
  redeemed_at: string;
}

// -----------------------------------------------------------------------------
// Tipos de aplicação (com relacionamentos resolvidos)
// -----------------------------------------------------------------------------

export interface UserMissionWithMission extends UserMission {
  mission: Mission | null;
}

export interface RedemptionWithReward extends Redemption {
  reward: Reward | null;
}

export interface AddLogInput {
  type: LogType;
  value: number;
  description?: string | null;
}

export interface AddLogResult {
  ok: boolean;
  pointsEarned: number;
  error?: string;
  completedMissionTitles?: string[];
}

export interface RedeemRewardResult {
  ok: boolean;
  error?: string;
  newBalance?: number;
}

export interface RedeemRewardRpcResult {
  ok: boolean;
  error?: string;
  redemption_id?: string;
  new_balance?: number;
}

// -----------------------------------------------------------------------------
// Tipo Database para o client do Supabase
// -----------------------------------------------------------------------------

type Insertable<T> = { [K in keyof T]?: T[K] };
type Updatable<T> = { [K in keyof T]?: T[K] };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insertable<Profile>;
        Update: Updatable<Profile>;
        Relationships: [];
      };
      logs: {
        Row: Log;
        Insert: Insertable<Log>;
        Update: Updatable<Log>;
        Relationships: [];
      };
      missions: {
        Row: Mission;
        Insert: Insertable<Mission>;
        Update: Updatable<Mission>;
        Relationships: [];
      };
      user_missions: {
        Row: UserMission;
        Insert: Insertable<UserMission>;
        Update: Updatable<UserMission>;
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey",
            columns: ["mission_id"],
            isOneToOne: false,
            referencedRelation: "missions",
            referencedColumns: ["id"],
          },
        ];
      };
      rewards: {
        Row: Reward;
        Insert: Insertable<Reward>;
        Update: Updatable<Reward>;
        Relationships: [];
      };
      redemptions: {
        Row: Redemption;
        Insert: Insertable<Redemption>;
        Update: Updatable<Redemption>;
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey",
            columns: ["reward_id"],
            isOneToOne: false,
            referencedRelation: "rewards",
            referencedColumns: ["id"],
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      redeem_reward: {
        Args: { p_user_id: string; p_reward_id: string };
        Returns: Json;
      };
      expire_stale_missions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      renew_daily_missions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      log_type: LogType;
      mission_status: MissionStatus;
      reward_status: RewardStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
