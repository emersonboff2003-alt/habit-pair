// =============================================================================
// Tipos manuais do Supabase (equivalente a `supabase gen types`)
// =============================================================================

export type LogType = "water" | "exercise" | "nutrition";
export type MissionStatus = "available" | "in_progress" | "completed" | "failed";
export type RewardStatus = "available" | "redeemed" | "fulfilled";
export type NutritionCategory = "macros" | "sweets" | "meals";
export type MealSlot = "breakfast" | "lunch" | "afternoon" | "dinner";
export type FoodCategory =
  | "grains"
  | "protein"
  | "vegetables"
  | "fruits"
  | "dairy"
  | "beverages"
  | "sweets"
  | "ready_meals";

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
  water_goal_ml: number;
  exercise_goal_min: number;
  created_at: string;
}

export type Log = {
  id: string;
  user_id: string;
  type: LogType;
  value: number;
  points_earned: number;
  description: string | null;
  exercise_type_id: string | null;
  created_at: string;
}

export type FoodItem = {
  id: string;
  name: string;
  category: FoodCategory;
  points: number;
  is_active: boolean;
  created_at: string;
}

export type MealLog = {
  id: string;
  user_id: string;
  slot: MealSlot;
  is_quick: boolean;
  notes: string | null;
  created_at: string;
}

export type MealLogItem = {
  id: string;
  meal_log_id: string;
  food_item_id: string | null;
  custom_name: string | null;
  portion: number;
  points: number;
  created_at: string;
}

export interface MealLogItemWithFood extends MealLogItem {
  food_item: { name: string } | null;
}

export interface MealLogWithItems extends MealLog {
  meal_log_items: MealLogItemWithFood[];
}

export type ExerciseType = {
  id: string;
  name: string;
  is_active: boolean;
}

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  keys: Json;
  created_at: string;
}

export type ReminderSettings = {
  user_id: string;
  notifications_enabled: boolean;
  water_enabled: boolean;
  water_times: string[];
  meal_enabled: boolean;
  meal_breakfast: string;
  meal_lunch: string;
  meal_afternoon: string;
  meal_dinner: string;
  exercise_enabled: boolean;
  exercise_time: string;
  updated_at: string;
}

export type ReminderSentLog = {
  id: string;
  user_id: string;
  reminder_key: string;
  sent_date: string;
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
  /** Sempre ativa (ex.: água) — não depende de ativação manual. */
  always_active: boolean;
  /** Missão temporária: aparece por um tempo e volta aleatoriamente depois. */
  is_temporary: boolean;
  /** Janela de permanência mínima (dias) quando uma temporária reaparece. */
  stay_min_days: number;
  /** Janela de permanência máxima (dias) quando uma temporária reaparece. */
  stay_max_days: number;
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
  /** Temporárias: prazo limite para ativar/completar (some depois disso). */
  available_until: string | null;
  /** Pontos efetivamente creditados por esta rodada (completa ou parcial). */
  points_awarded: number;
  /** Quando a missão volta a ficar disponível (após concluída/falha). */
  next_available_at: string | null;
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

export interface MealItemInput {
  foodItemId?: string;
  customName?: string;
  portion?: number;
}

export interface InsertMealLogRpcResult {
  ok: boolean;
  error?: string;
  points_earned?: number;
  meal_log_id?: string;
}

export interface InsertExerciseLogRpcResult {
  ok: boolean;
  error?: string;
  points_earned?: number;
}

export interface ReminderSettingsInput {
  notifications_enabled: boolean;
  water_enabled: boolean;
  water_times: string[];
  meal_enabled: boolean;
  meal_breakfast: string;
  meal_lunch: string;
  meal_afternoon: string;
  meal_dinner: string;
  exercise_enabled: boolean;
  exercise_time: string;
}

export interface AddLogResult {
  ok: boolean;
  pointsEarned: number;
  error?: string;
  completedMissionTitles?: string[];
  /** Id do log recém-criado (para permitir "desfazer" logo após registrar). */
  logId?: string;
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
        Relationships: [
          {
            foreignKeyName: "logs_exercise_type_id_fkey",
            columns: ["exercise_type_id"],
            isOneToOne: false,
            referencedRelation: "exercise_types",
            referencedColumns: ["id"],
          },
        ];
      };
      exercise_types: {
        Row: ExerciseType;
        Insert: Insertable<ExerciseType>;
        Update: Updatable<ExerciseType>;
        Relationships: [];
      };
      food_items: {
        Row: FoodItem;
        Insert: Insertable<FoodItem>;
        Update: Updatable<FoodItem>;
        Relationships: [];
      };
      meal_logs: {
        Row: MealLog;
        Insert: Insertable<MealLog>;
        Update: Updatable<MealLog>;
        Relationships: [];
      };
      meal_log_items: {
        Row: MealLogItem;
        Insert: Insertable<MealLogItem>;
        Update: Updatable<MealLogItem>;
        Relationships: [
          {
            foreignKeyName: "meal_log_items_meal_log_id_fkey",
            columns: ["meal_log_id"],
            isOneToOne: false,
            referencedRelation: "meal_logs",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "meal_log_items_food_item_id_fkey",
            columns: ["food_item_id"],
            isOneToOne: false,
            referencedRelation: "food_items",
            referencedColumns: ["id"],
          },
        ];
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
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Insertable<PushSubscriptionRow>;
        Update: Updatable<PushSubscriptionRow>;
        Relationships: [];
      };
      reminder_settings: {
        Row: ReminderSettings;
        Insert: Insertable<ReminderSettings>;
        Update: Updatable<ReminderSettings>;
        Relationships: [];
      };
      reminder_sent_logs: {
        Row: ReminderSentLog;
        Insert: Insertable<ReminderSentLog>;
        Update: Updatable<ReminderSentLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      redeem_reward: {
        Args: { p_user_id: string; p_reward_id: string };
        Returns: Json;
      };
      insert_meal_log: {
        Args: {
          p_user_id: string;
          p_slot: MealSlot;
          p_is_quick: boolean;
          p_items?: Json;
        };
        Returns: Json;
      };
      insert_exercise_log: {
        Args: {
          p_user_id: string;
          p_exercise_type_id?: string | null;
          p_minutes?: number | null;
          p_distance?: string | null;
        };
        Returns: Json;
      };
      roll_missions: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      activate_mission: {
        Args: { p_user_id: string; p_mission_id: string };
        Returns: Json;
      };
      delete_log: {
        Args: { p_user_id: string; p_log_id: string };
        Returns: Json;
      };
      create_profile: {
        Args: { p_name: string; p_theme?: string };
        Returns: Json;
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
