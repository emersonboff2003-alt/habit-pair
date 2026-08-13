// =============================================================================
// Cliente Supabase mock (em memória) para desenvolvimento/teste sem backend.
//
// Ativo automaticamente quando NEXT_PUBLIC_SUPABASE_URL não está configurada
// (ou quando NEXT_PUBLIC_MOCK_MODE=true). Espelha o schema.sql:
//   - perfis Émerson & Ana, missões e recompensas seedadas
//   - regras de gamificação do trigger handle_log_insert (pontos, tetos,
//     nutrição única/dia, progresso de missões + crédito de pontos)
//   - RPC redeem_reward (resgate atômico), activate_mission (ativação manual)
//     e roll_missions (ciclo diário de missões: temporárias, parcial, renova)
//
// IMPORTANTE: os dados ficam em memória no processo do servidor Next e são
// zerados a cada restart do `npm run dev`.
// =============================================================================

import type {
  Json,
  Log,
  LogType,
  MealSlot,
  Mission,
  Profile,
  Redemption,
  Reward,
  UserMission,
} from "@/types/database";
import {
  calcPointsForLog,
  COMPLETE_MEAL_BONUS,
  COMPLETE_MEAL_MIN_ITEMS,
  CUSTOM_ITEM_POINTS,
  dailyCapFor,
  QUICK_EXERCISE_MIN_EQUIV,
  QUICK_EXERCISE_POINTS,
  QUICK_MEAL_POINTS,
} from "@/lib/gamification";
import { startOfToday as startOfTodayBr } from "@/lib/utils";

export function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_MOCK_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

function startOfToday(): string {
  return startOfTodayBr();
}

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

/** Início do dia daqui a N dias (UTC local, espelha o date_trunc do SQL). */
function dayStartFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Quando a missão voltará a ficar disponível após uma rodada (espelha o SQL). */
function nextAvailableAt(mission: Mission): string {
  if (mission.always_active || mission.duration_days === 1) return dayStartFromNow(1);
  if (mission.is_temporary) return daysFromNow(2 + Math.floor(Math.random() * 6));
  return daysFromNow(mission.duration_days);
}

// -----------------------------------------------------------------------------
// Seeds (espelham o schema.sql; pontos de exemplo para testar a loja já)
// -----------------------------------------------------------------------------

const PROFILES: Profile[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Émerson",
    pin_hash: null,
    points_balance: 120,
    total_points_earned: 120,
    theme: "classic-dark",
    water_goal_ml: 2500,
    exercise_goal_min: 90,
    created_at: now(),
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "Ana",
    pin_hash: null,
    points_balance: 60,
    total_points_earned: 60,
    theme: "classic-dark",
    water_goal_ml: 2500,
    exercise_goal_min: 90,
    created_at: now(),
  },
];

const MISSIONS: Mission[] = [
  {
    id: "b0000000-0000-0000-0000-000000000001",
    title: "Água do dia",
    description: "Beba 2500ml de água hoje.",
    target_type: "water",
    target_value: 2500,
    duration_days: 1,
    reward_points: 50,
    is_cooperative: false,
    is_active: true,
    always_active: true,
    is_temporary: false,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000002",
    title: "Treino do dia",
    description: "Complete 90 minutos de atividade física hoje.",
    target_type: "exercise",
    target_value: 90,
    duration_days: 1,
    reward_points: 90,
    is_cooperative: false,
    is_active: true,
    always_active: false,
    is_temporary: false,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    title: "Nutrição do dia",
    description: "Registre as 4 refeições do dia (café, almoço, lanche e jantar).",
    target_type: "nutrition",
    target_value: 4,
    duration_days: 1,
    reward_points: 100,
    is_cooperative: false,
    is_active: true,
    always_active: false,
    is_temporary: false,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000004",
    title: "Hidratação em dupla (semana)",
    description: "Juntos, bebam 17.500ml (2500ml/dia cada) em 7 dias.",
    target_type: "water",
    target_value: 17500,
    duration_days: 7,
    reward_points: 200,
    is_cooperative: true,
    is_active: true,
    always_active: false,
    is_temporary: true,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000005",
    title: "Reto de 3 dias de treino",
    description: "Complete 270 minutos de atividade física (90min/dia) em 3 dias.",
    target_type: "exercise",
    target_value: 270,
    duration_days: 3,
    reward_points: 120,
    is_cooperative: false,
    is_active: true,
    always_active: false,
    is_temporary: false,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000006",
    title: "Semana em movimento",
    description: "Complete 420 minutos de atividade física em 7 dias.",
    target_type: "exercise",
    target_value: 420,
    duration_days: 7,
    reward_points: 180,
    is_cooperative: false,
    is_active: true,
    always_active: false,
    is_temporary: true,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000007",
    title: "Água da semana",
    description: "Beba 15.000ml de água em 7 dias.",
    target_type: "water",
    target_value: 15000,
    duration_days: 7,
    reward_points: 140,
    is_cooperative: false,
    is_active: true,
    always_active: false,
    is_temporary: false,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000008",
    title: "Nutrição na semana",
    description: "Registre 20 refeições em 7 dias.",
    target_type: "nutrition",
    target_value: 20,
    duration_days: 7,
    reward_points: 160,
    is_cooperative: false,
    is_active: true,
    always_active: false,
    is_temporary: true,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000009",
    title: "Treino em dupla (semana)",
    description: "Juntos, completem 700 minutos de atividade física em 7 dias.",
    target_type: "exercise",
    target_value: 700,
    duration_days: 7,
    reward_points: 260,
    is_cooperative: true,
    is_active: true,
    always_active: false,
    is_temporary: true,
    stay_min_days: 1,
    stay_max_days: 3,
    created_at: now(),
  },
];

const USER_MISSIONS: UserMission[] = [
  // Água (sempre ativa) inicia 'in_progress'; demais iniciam desativadas ('available').
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000001",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000002",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000003",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000001",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000002",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000003",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: null,
    mission_id: "b0000000-0000-0000-0000-000000000004",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: daysFromNow(2),
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000005",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000006",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: daysFromNow(2),
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000007",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000008",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: daysFromNow(3),
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000005",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000006",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: daysFromNow(2),
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000007",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: null,
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000008",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: daysFromNow(3),
    points_awarded: 0,
    next_available_at: null,
  },
  {
    id: newId(),
    user_id: null,
    mission_id: "b0000000-0000-0000-0000-000000000009",
    current_progress: 0,
    status: "available",
    started_at: now(),
    completed_at: null,
    available_until: daysFromNow(3),
    points_awarded: 0,
    next_available_at: null,
  },
];

const REWARDS: Reward[] = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    title: "Jantar fora à escolha do outro",
    description: "O(a) parceiro(a) escolhe o restaurante.",
    cost_points: 150,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    title: "Massagem de 30 minutos",
    description: "Sessão de massagem relaxante oferecida pelo(a) parceiro(a).",
    cost_points: 120,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    title: "Sessão Netflix + pizza",
    description: "Escolha o filme/série e a pizza do dia.",
    cost_points: 80,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    title: "Manhã livre sem tarefas",
    description: "Um período da manhã inteira sem afazeres domésticos.",
    cost_points: 100,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000005",
    title: "Café da manhã na cama",
    description: "O(a) parceiro(a) prepara seu café favorito e serve na cama.",
    cost_points: 40,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000006",
    title: "Escolher o filme da sessão",
    description: "Você escolhe o filme/série sem discussão.",
    cost_points: 50,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000007",
    title: "Dia sem cozinhar",
    description: "O(a) parceiro(a) cuida de todas as refeições do dia.",
    cost_points: 110,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000008",
    title: "Sobremesa da sua escolha",
    description: "Escolha a sobremesa do dia, sem limites.",
    cost_points: 60,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000009",
    title: "Passeio no parque",
    description: "Um passeio ao ar livre juntos, no seu ritmo.",
    cost_points: 90,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000010",
    title: "Férias do serviço doméstico",
    description: "O(a) parceiro(a) assume todas as tarefas de casa por um dia.",
    cost_points: 200,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000011",
    title: "Rolezinho de bike",
    description: "Um pedal juntos no fim de semana.",
    cost_points: 100,
    created_by: null,
    created_at: now(),
  },
  {
    id: "c0000000-0000-0000-0000-000000000012",
    title: "Sessão de carinho de 15 min",
    description: "15 minutos dedicados só a vocês dois, sem telas.",
    cost_points: 70,
    created_by: null,
    created_at: now(),
  },
];

export interface FoodItemSeed {
  id: string;
  name: string;
  category: string;
  points: number;
  is_active: boolean;
  created_at: string;
}

const FOOD_ITEMS: FoodItemSeed[] = [
  { id: "d0000000-0000-0000-0000-000000000001", name: "Arroz", category: "grains", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000002", name: "Arroz integral", category: "grains", points: 12, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000003", name: "Feijão", category: "grains", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000004", name: "Pão integral", category: "grains", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000005", name: "Pão francês", category: "grains", points: 5, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000006", name: "Tapioca", category: "grains", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000007", name: "Batata", category: "grains", points: 7, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000008", name: "Macarrão", category: "grains", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000009", name: "Aveia", category: "grains", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000010", name: "Frango grelhado", category: "protein", points: 15, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000011", name: "Carne bovina", category: "protein", points: 15, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000012", name: "Peixe", category: "protein", points: 15, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000013", name: "Ovo", category: "protein", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000014", name: "Lentilha", category: "protein", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000015", name: "Grão-de-bico", category: "protein", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000016", name: "Tofu", category: "protein", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000017", name: "Salada verde", category: "vegetables", points: 10, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000018", name: "Brócolis", category: "vegetables", points: 12, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000019", name: "Legumes no vapor", category: "vegetables", points: 12, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000020", name: "Cenoura", category: "vegetables", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000021", name: "Tomate", category: "vegetables", points: 5, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000022", name: "Abobrinha", category: "vegetables", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000023", name: "Fruta", category: "fruits", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000024", name: "Banana", category: "fruits", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000025", name: "Iogurte", category: "dairy", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000026", name: "Leite", category: "dairy", points: 6, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000027", name: "Queijo", category: "dairy", points: 8, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000028", name: "Café sem açúcar", category: "beverages", points: 3, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000029", name: "Suco natural", category: "beverages", points: 6, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000030", name: "Água de coco", category: "beverages", points: 5, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000031", name: "Chocolate", category: "sweets", points: 4, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000032", name: "Sobremesa", category: "sweets", points: 4, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000033", name: "Refrigerante", category: "sweets", points: 3, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000034", name: "Marmita caseira", category: "ready_meals", points: 12, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000035", name: "Comida rápida", category: "ready_meals", points: 3, is_active: true, created_at: now() },
  { id: "d0000000-0000-0000-0000-000000000036", name: "Pizza", category: "ready_meals", points: 4, is_active: true, created_at: now() },
];

export interface ExerciseTypeSeed {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

const EXERCISE_TYPES: ExerciseTypeSeed[] = [
  { id: "e0000000-0000-0000-0000-000000000001", name: "Corrida", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000002", name: "Caminhada", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000003", name: "Musculação", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000004", name: "Bicicleta", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000005", name: "Natação", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000006", name: "HIIT", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000007", name: "Yoga e Pilates", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000008", name: "Futebol", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000009", name: "Basquete", is_active: true, created_at: now() },
  { id: "e0000000-0000-0000-0000-000000000010", name: "Dança", is_active: true, created_at: now() },
];

const MEAL_LOGS: MealLogSeed[] = [];
const MEAL_LOG_ITEMS: MealLogItemSeed[] = [];
const LOGS: Log[] = [];
const REDEMPTIONS: Redemption[] = [];
const PUSH_SUBSCRIPTIONS: Record<string, unknown>[] = [];
const REMINDER_SENT_LOGS: Record<string, unknown>[] = [];

export interface ReminderSettingsSeed {
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

const REMINDER_SETTINGS: ReminderSettingsSeed[] = [
  {
    user_id: "a0000000-0000-0000-0000-000000000001",
    notifications_enabled: false,
    water_enabled: true,
    water_times: ["09:00", "12:00", "15:00", "18:00", "21:00"],
    meal_enabled: true,
    meal_breakfast: "08:00",
    meal_lunch: "12:30",
    meal_afternoon: "16:00",
    meal_dinner: "19:30",
    exercise_enabled: true,
    exercise_time: "18:00",
    updated_at: now(),
  },
  {
    user_id: "a0000000-0000-0000-0000-000000000002",
    notifications_enabled: false,
    water_enabled: true,
    water_times: ["09:00", "12:00", "15:00", "18:00", "21:00"],
    meal_enabled: true,
    meal_breakfast: "08:00",
    meal_lunch: "12:30",
    meal_afternoon: "16:00",
    meal_dinner: "19:30",
    exercise_enabled: true,
    exercise_time: "18:00",
    updated_at: now(),
  },
];

export interface MealLogSeed {
  id: string;
  user_id: string;
  slot: MealSlot;
  is_quick: boolean;
  notes: string | null;
  created_at: string;
}

export interface MealLogItemSeed {
  id: string;
  meal_log_id: string;
  food_item_id: string | null;
  custom_name: string | null;
  portion: number;
  points: number;
  created_at: string;
}

type TableName =
  | "profiles"
  | "logs"
  | "missions"
  | "user_missions"
  | "rewards"
  | "redemptions"
  | "food_items"
  | "meal_logs"
  | "meal_log_items"
  | "exercise_types"
  | "push_subscriptions"
  | "reminder_settings"
  | "reminder_sent_logs";

type Store = Record<TableName, Record<string, unknown>[]>;

function getStore(): Store {
  return {
    profiles: PROFILES as unknown as Record<string, unknown>[],
    logs: LOGS as unknown as Record<string, unknown>[],
    missions: MISSIONS as unknown as Record<string, unknown>[],
    user_missions: USER_MISSIONS as unknown as Record<string, unknown>[],
    rewards: REWARDS as unknown as Record<string, unknown>[],
    redemptions: REDEMPTIONS as unknown as Record<string, unknown>[],
    food_items: FOOD_ITEMS as unknown as Record<string, unknown>[],
    meal_logs: MEAL_LOGS as unknown as Record<string, unknown>[],
    meal_log_items: MEAL_LOG_ITEMS as unknown as Record<string, unknown>[],
    exercise_types: EXERCISE_TYPES as unknown as Record<string, unknown>[],
    push_subscriptions: PUSH_SUBSCRIPTIONS as unknown as Record<string, unknown>[],
    reminder_settings: REMINDER_SETTINGS as unknown as Record<string, unknown>[],
    reminder_sent_logs: REMINDER_SENT_LOGS as unknown as Record<string, unknown>[],
  };
}

// -----------------------------------------------------------------------------
// Lógica de insert em logs (espelha o trigger handle_log_insert do schema.sql)
// -----------------------------------------------------------------------------

function insertLog(payload: Record<string, unknown>): { data: Log | null; error: { message: string } | null } {
  const user_id = payload.user_id as string;
  const type = payload.type as LogType;
  const value = payload.value as number;
  const description = (payload.description as string) ?? null;
  const exercise_type_id = (payload.exercise_type_id as string | null) ?? null;

  // 1) Nutrição: apenas 1 registro por categoria por dia.
  if (type === "nutrition" && !description?.startsWith("meal:")) {
    const duplicate = LOGS.some(
      (l) =>
        l.user_id === user_id &&
        l.type === "nutrition" &&
        l.description === description &&
        l.created_at >= startOfToday(),
    );
    if (duplicate) {
      return {
        data: null,
        error: {
          message: "nutricao_duplicada: Check-in nutricional já registrado hoje para esta categoria.",
        },
      };
    }
  }

  // 2) Pontos respeitando o teto diário do tipo.
  //    Refeições (meal:*) e treino rápido ('quick') chegam com pontos do servidor.
  const alreadyToday = LOGS.filter(
    (l) => l.user_id === user_id && l.type === type && l.created_at >= startOfToday(),
  ).reduce((sum, l) => sum + l.points_earned, 0);
  const cap = dailyCapFor(type);
  let raw: number;
  if (
    (type === "nutrition" && description?.startsWith("meal:")) ||
    (type === "exercise" && description === "quick")
  ) {
    raw = (payload.points_earned as number) ?? 0;
  } else {
    raw = calcPointsForLog(type, value, description);
  }
  const pointsEarned = Math.max(0, Math.min(raw, cap - alreadyToday));

  const log: Log = {
    id: newId(),
    user_id,
    type,
    value,
    points_earned: pointsEarned,
    description,
    exercise_type_id,
    created_at: now(),
  };
  LOGS.push(log);

  // 3) Credita os pontos do registro no saldo do perfil.
  if (pointsEarned > 0) {
    const profile = PROFILES.find((p) => p.id === user_id);
    if (profile) {
      profile.points_balance += pointsEarned;
      profile.total_points_earned += pointsEarned;
    }
  }

  // 4) Motor de missões: progresso + conclusão + crédito de pontos.
  for (const um of USER_MISSIONS) {
    const mission = MISSIONS.find((m) => m.id === um.mission_id);
    if (!mission || mission.target_type !== type || um.status !== "in_progress" || !mission.is_active) {
      continue;
    }
    if (um.user_id !== user_id && um.user_id !== null) continue;

    um.current_progress += value;
    if (um.current_progress >= mission.target_value) {
      um.status = "completed";
      um.completed_at = now();
      um.points_awarded = mission.reward_points;
      um.next_available_at = nextAvailableAt(mission);
      if (mission.is_cooperative) {
        for (const profile of PROFILES) {
          profile.points_balance += mission.reward_points;
          profile.total_points_earned += mission.reward_points;
        }
      } else if (um.user_id) {
        const profile = PROFILES.find((p) => p.id === um.user_id);
        if (profile) {
          profile.points_balance += mission.reward_points;
          profile.total_points_earned += mission.reward_points;
        }
      }
    }
  }

  return { data: log, error: null };
}

// -----------------------------------------------------------------------------
// Mini query builder (subset da API do supabase-js usada pelo app)
// -----------------------------------------------------------------------------

type Row = Record<string, unknown>;
type MockError = { message: string } | null;

function pick(row: Row, keys: string[]): Row {
  const out: Row = {};
  for (const k of keys) {
    if (k && k in row) out[k] = row[k];
  }
  return out;
}

function project(row: Row, cols: string): Row {
  if (cols === "*") return { ...row };
  const parts = cols.split(",").map((s) => s.trim());
  const out: Row = {};
  for (const part of parts) {
    if (part === "*") {
      Object.assign(out, row);
    } else {
      const aliased = part.match(/^([\w-]+):(\w+)\(([^)]*)\)$/);
      const plain = !aliased ? part.match(/^(\w+)\(([^)]*)\)$/) : null;
      if (aliased || plain) {
        const m = (aliased ?? plain)!;
        const relKey = m[1];
        const relTable = aliased ? m[2] : m[1];
        const inner = (aliased ? m[3] : m[2]).split(",").map((s) => s.trim());
        const fkKey =
          relTable === "missions"
            ? "mission_id"
            : relTable === "rewards"
              ? "reward_id"
              : relTable === "meal_log_items"
                ? "meal_log_id"
                : relTable === "food_items"
                  ? "food_item_id"
                  : undefined;
        const refId = fkKey ? (row[fkKey] as string | null) : null;
        const ref = refId ? getStore()[relTable as TableName].find((r: Row) => r.id === refId) : undefined;
        out[relKey] = ref ? pick(ref, inner) : null;
      } else if (part in row) {
        out[part] = row[part];
      }
    }
  }
  return out;
}

function orClause(row: Row, filter: string): boolean {
  const clauses = filter.split(",");
  return clauses.some((clause) => {
    const [col, op, ...rest] = clause.split(".");
    const rawVal = rest.join(".");
    const val: string | null = rawVal === "null" ? null : rawVal;
    if (op === "is" && val === null) return row[col] == null;
    if (op === "is") return row[col] === val;
    if (op === "eq") return row[col] === val;
    if (op === "neq") return row[col] !== val;
    return false;
  });
}

class MockBuilder {
  private table: TableName;
  private mode: "select" | "insert" | "update" | "upsert" | "delete";
  private payload?: Row;
  private upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
  private cols = "*";
  private preds: ((r: Row) => boolean)[] = [];
  private orderCol?: string;
  private orderAsc = true;
  private maxRows?: number;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(table: TableName) {
    this.table = table;
    this.mode = "select";
  }

  select(cols: string) {
    this.cols = cols;
    return this;
  }

  eq(col: string, value: unknown) {
    this.preds.push((r) => r[col] === value);
    return this;
  }

  gte(col: string, value: unknown) {
    this.preds.push((r) => (r[col] as string) >= (value as string));
    return this;
  }

  gt(col: string, value: unknown) {
    this.preds.push((r) => (r[col] as string) > (value as string));
    return this;
  }

  lt(col: string, value: unknown) {
    this.preds.push((r) => (r[col] as string) < (value as string));
    return this;
  }

  or(filter: string) {
    this.preds.push((r) => orClause(r, filter));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.maxRows = n;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this as unknown as MockBuilder;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this as unknown as MockBuilder;
  }

  insert(payload: Row) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert";
    this.payload = payload;
    this.upsertOptions = options;
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  then<TResult1 = { data: Row | Row[] | null; error: MockError }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row | Row[] | null; error: MockError }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: Row | Row[] | null; error: MockError }> {
    if (this.mode === "insert") {
      if (this.table === "logs") {
        const result = insertLog(this.payload ?? {});
        if (result.error) {
          return { data: null, error: result.error };
        }
        const row = project(result.data as unknown as Row, this.cols);
        if (this.singleMode === "single") return { data: row, error: null };
        return { data: [row], error: null };
      }
      const row: Row = { ...(this.payload ?? {}) };
      if (!row.id) row.id = newId();
      if (!row.created_at) row.created_at = now();
      getStore()[this.table].push(row);
      return { data: project(row, this.cols), error: null };
    }

    if (this.mode === "upsert") {
      // Upsert respeitando a coluna de conflito (ex.: endpoint, user_id).
      const conflictKey = this.upsertOptions?.onConflict;
      const payload = this.payload ?? {};
      if (conflictKey && payload[conflictKey] != null) {
        const existing = getStore()[this.table].find((r) => r[conflictKey] === payload[conflictKey]);
        if (existing) {
          if (!this.upsertOptions?.ignoreDuplicates) {
            Object.assign(existing, payload);
          }
          return { data: project(existing, this.cols), error: null };
        }
      }
      const row: Row = { ...payload };
      if (!row.id) row.id = newId();
      if (!row.created_at) row.created_at = now();
      getStore()[this.table].push(row);
      return { data: project(row, this.cols), error: null };
    }

    if (this.mode === "delete") {
      const rows = getStore()[this.table];
      for (let i = rows.length - 1; i >= 0; i--) {
        if (this.preds.every((p) => p(rows[i]))) rows.splice(i, 1);
      }
      return { data: null, error: null };
    }

    if (this.mode === "update") {
      const rows = getStore()[this.table].filter((r) => this.preds.every((p) => p(r)));
      for (const row of rows) {
        Object.assign(row, this.payload ?? {});
      }
      return { data: null, error: null };
    }

    let rows = getStore()[this.table].filter((r) => this.preds.every((p) => p(r)));
    if (this.orderCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[this.orderCol!];
        const bv = b[this.orderCol!];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.maxRows !== undefined) rows = rows.slice(0, this.maxRows);

    const projected = rows.map((r) => project(r, this.cols));

    if (this.singleMode === "single") {
      if (projected.length === 0) {
        return { data: null, error: { message: "PGRST116: Resultado contém 0 linhas" } };
      }
      if (projected.length > 1) {
        return { data: null, error: { message: "PGRST116: Resultado contém mais de uma linha" } };
      }
      return { data: projected[0], error: null };
    }
    if (this.singleMode === "maybe") {
      return { data: projected[0] ?? null, error: null };
    }
    return { data: projected, error: null };
  }
}

// -----------------------------------------------------------------------------
// RPCs mock
// -----------------------------------------------------------------------------

interface MealItemLike {
  foodItemId?: string;
  customName?: string;
  portion?: number;
}

function rpcMock(
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: Json | number | null; error: MockError }> {
  if (fn === "redeem_reward") {
    const userId = args?.p_user_id;
    const rewardId = args?.p_reward_id;
    const reward = REWARDS.find((r) => r.id === rewardId);
    if (!reward) {
      return Promise.resolve({ data: { ok: false, error: "reward_not_found" } as Json, error: null });
    }
    const profile = PROFILES.find((p) => p.id === userId);
    if (!profile) {
      return Promise.resolve({ data: { ok: false, error: "user_not_found" } as Json, error: null });
    }
    if (profile.points_balance < reward.cost_points) {
      return Promise.resolve({ data: { ok: false, error: "insufficient_points" } as Json, error: null });
    }
    profile.points_balance -= reward.cost_points;
    const redemption: Redemption = {
      id: newId(),
      reward_id: reward.id,
      user_id: profile.id,
      status: "redeemed",
      redeemed_at: now(),
    };
    REDEMPTIONS.push(redemption);
    return Promise.resolve({
      data: { ok: true, redemption_id: redemption.id, new_balance: profile.points_balance } as Json,
      error: null,
    });
  }

  if (fn === "insert_meal_log") {
    const userId = args?.p_user_id as string;
    const slot = args?.p_slot as MealSlot;
    const isQuick = Boolean(args?.p_is_quick);
    const items = (Array.isArray(args?.p_items) ? args?.p_items : []) as MealItemLike[];

    if (!userId || !slot) {
      return Promise.resolve({ data: { ok: false, error: "user_not_found" } as Json, error: null });
    }

    let points = 0;
    let count = 0;

    if (isQuick) {
      const duplicate = MEAL_LOGS.some(
        (m) =>
          m.user_id === userId &&
          m.slot === slot &&
          m.is_quick &&
          m.created_at >= startOfToday(),
      );
      if (duplicate) {
        return Promise.resolve({
          data: { ok: false, error: "refeicao_rapida_duplicada" } as Json,
          error: null,
        });
      }
      count = 1;
      points = QUICK_MEAL_POINTS;
    } else {
      if (items.length === 0) {
        return Promise.resolve({ data: { ok: false, error: "sem_itens" } as Json, error: null });
      }
      for (const item of items) {
        const portion = Math.max(1, Math.floor(item.portion ?? 1));
        let itemPoints: number;
        if (item.foodItemId) {
          const food = FOOD_ITEMS.find((f) => f.id === item.foodItemId && f.is_active);
          if (!food) {
            return Promise.resolve({ data: { ok: false, error: "item_invalido" } as Json, error: null });
          }
          itemPoints = food.points;
        } else {
          itemPoints = CUSTOM_ITEM_POINTS;
        }
        points += itemPoints * portion;
        count += 1;
      }
      if (count >= COMPLETE_MEAL_MIN_ITEMS) {
        points += COMPLETE_MEAL_BONUS;
      }
    }

    const mealLog: MealLogSeed = {
      id: newId(),
      user_id: userId,
      slot,
      is_quick: isQuick,
      notes: null,
      created_at: now(),
    };
    MEAL_LOGS.push(mealLog);

    if (!isQuick) {
      for (const item of items) {
        const portion = Math.max(1, Math.floor(item.portion ?? 1));
        let itemPoints: number;
        if (item.foodItemId) {
          const food = FOOD_ITEMS.find((f) => f.id === item.foodItemId);
          itemPoints = food ? food.points : CUSTOM_ITEM_POINTS;
        } else {
          itemPoints = CUSTOM_ITEM_POINTS;
        }
        MEAL_LOG_ITEMS.push({
          id: newId(),
          meal_log_id: mealLog.id,
          food_item_id: item.foodItemId ?? null,
          custom_name: item.customName ?? null,
          portion,
          points: itemPoints * portion,
          created_at: now(),
        });
      }
    }

    const description = `meal:${slot}:${mealLog.id}${isQuick ? ":quick" : ""}`;
    const res = insertLog({
      user_id: userId,
      type: "nutrition",
      value: count,
      points_earned: points,
      description,
    });
    if (res.error) {
      return Promise.resolve({ data: null, error: res.error });
    }
    return Promise.resolve({
      data: {
        ok: true,
        points_earned: res.data?.points_earned ?? 0,
        meal_log_id: mealLog.id,
      } as Json,
      error: null,
    });
  }

  if (fn === "insert_exercise_log") {
    const userId = args?.p_user_id as string;
    const exerciseTypeId = (args?.p_exercise_type_id as string | null | undefined) ?? null;
    const minutes = args?.p_minutes != null ? Number(args?.p_minutes) : null;
    const distance = (args?.p_distance as string | null | undefined) ?? null;

    if (!userId) {
      return Promise.resolve({ data: { ok: false, error: "user_not_found" } as Json, error: null });
    }

    let points: number;
    let value: number;
    let description: string | null;

    if (!exerciseTypeId) {
      const duplicate = LOGS.some(
        (l) =>
          l.user_id === userId &&
          l.type === "exercise" &&
          l.description === "quick" &&
          l.created_at >= startOfToday(),
      );
      if (duplicate) {
        return Promise.resolve({
          data: { ok: false, error: "treino_rapido_duplicado" } as Json,
          error: null,
        });
      }
      points = QUICK_EXERCISE_POINTS;
      value = QUICK_EXERCISE_MIN_EQUIV;
      description = "quick";
    } else {
      const valid = EXERCISE_TYPES.some((t) => t.id === exerciseTypeId && t.is_active);
      if (!valid) {
        return Promise.resolve({
          data: { ok: false, error: "tipo_exercicio_invalido" } as Json,
          error: null,
        });
      }
      if (minutes == null || minutes <= 0 || minutes > 600) {
        return Promise.resolve({ data: { ok: false, error: "minutos_invalidos" } as Json, error: null });
      }
      points = minutes;
      value = minutes;
      description = distance;
    }

    const res = insertLog({
      user_id: userId,
      type: "exercise",
      value,
      points_earned: points,
      description,
      exercise_type_id: exerciseTypeId,
    });
    if (res.error) {
      return Promise.resolve({ data: null, error: res.error });
    }
    return Promise.resolve({
      data: { ok: true, points_earned: res.data?.points_earned ?? 0 } as Json,
      error: null,
    });
  }

  if (fn === "delete_log") {
    const userId = args?.p_user_id as string | undefined;
    const logId = args?.p_log_id as string | undefined;
    if (!userId || !logId) {
      return Promise.resolve({ data: { ok: false, error: "parametros_invalidos" }, error: null });
    }

    const index = LOGS.findIndex((l) => l.id === logId && l.user_id === userId);
    if (index === -1) {
      return Promise.resolve({ data: { ok: false, error: "registro_nao_encontrado" }, error: null });
    }

    const log = LOGS[index];

    // Reverte pontos no perfil.
    if (log.points_earned > 0) {
      const profile = PROFILES.find((p) => p.id === userId);
      if (profile) {
        profile.points_balance = Math.max(0, profile.points_balance - log.points_earned);
        profile.total_points_earned = Math.max(0, profile.total_points_earned - log.points_earned);
      }
    }

    // Recua progresso das missões em andamento do mesmo tipo.
    for (const um of USER_MISSIONS) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || mission.target_type !== log.type || um.status !== "in_progress") continue;
      if (um.user_id !== userId && um.user_id !== null) continue;
      um.current_progress = Math.max(0, um.current_progress - log.value);
    }

    // Se for refeição, apaga meal_logs + itens.
    if (log.description?.startsWith("meal:")) {
      const mealLogId = log.description.split(":")[2];
      for (let i = MEAL_LOG_ITEMS.length - 1; i >= 0; i--) {
        if (MEAL_LOG_ITEMS[i].meal_log_id === mealLogId) MEAL_LOG_ITEMS.splice(i, 1);
      }
      for (let i = MEAL_LOGS.length - 1; i >= 0; i--) {
        if (MEAL_LOGS[i].id === mealLogId && MEAL_LOGS[i].user_id === userId) MEAL_LOGS.splice(i, 1);
      }
    }

    LOGS.splice(index, 1);

    const profile = PROFILES.find((p) => p.id === userId);
    return Promise.resolve({
      data: {
        ok: true,
        points_reverted: log.points_earned,
        new_balance: profile ? profile.points_balance : 0,
      } as Json,
      error: null,
    });
  }

  if (fn === "create_profile") {
    const name = (args?.p_name as string | undefined)?.trim();
    const theme = (args?.p_theme as string | undefined) || "classic-dark";
    if (!name) {
      return Promise.resolve({ data: { ok: false, error: "nome_invalido" }, error: null });
    }
    if (name.length > 50) {
      return Promise.resolve({ data: { ok: false, error: "nome_muito_longo" }, error: null });
    }
    if (PROFILES.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return Promise.resolve({ data: { ok: false, error: "nome_duplicado" }, error: null });
    }

    const profile: Profile = {
      id: newId(),
      name,
      pin_hash: null,
      points_balance: 0,
      total_points_earned: 0,
      theme,
      water_goal_ml: 2500,
      exercise_goal_min: 90,
      created_at: now(),
    };
    PROFILES.push(profile);

    REMINDER_SETTINGS.push({
      user_id: profile.id,
      notifications_enabled: false,
      water_enabled: true,
      water_times: ["09:00", "12:00", "15:00", "18:00", "21:00"],
      meal_enabled: true,
      meal_breakfast: "08:00",
      meal_lunch: "12:30",
      meal_afternoon: "16:00",
      meal_dinner: "19:30",
      exercise_enabled: true,
      exercise_time: "18:00",
      updated_at: now(),
    });

    for (const mission of MISSIONS) {
      if (!mission.is_active || mission.is_cooperative) continue;
      USER_MISSIONS.push({
        id: newId(),
        user_id: profile.id,
        mission_id: mission.id,
        current_progress: 0,
        status: mission.always_active ? "in_progress" : "available",
        started_at: now(),
        completed_at: null,
        available_until: mission.is_temporary ? daysFromNow(2) : null,
        points_awarded: 0,
        next_available_at: null,
      });
    }

    return Promise.resolve({ data: { ok: true, profile_id: profile.id } as Json, error: null });
  }

  if (fn === "activate_mission") {
    const missionId = args?.p_mission_id as string | undefined;
    const userId = args?.p_user_id as string | undefined;
    if (!missionId || !userId) {
      return Promise.resolve({ data: { ok: false, error: "parametros_invalidos" }, error: null });
    }

    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) {
      return Promise.resolve({ data: { ok: false, error: "missao_nao_encontrada" }, error: null });
    }
    if (!mission.is_active) {
      return Promise.resolve({ data: { ok: false, error: "missao_inativa" }, error: null });
    }
    if (mission.always_active) {
      return Promise.resolve({ data: { ok: false, error: "missao_sempre_ativa" }, error: null });
    }

    const available = USER_MISSIONS.find(
      (um) =>
        um.mission_id === missionId &&
        um.status === "available" &&
        (um.user_id === userId || (um.user_id === null && mission.is_cooperative)),
    );

    if (!available) {
      const already = USER_MISSIONS.some(
        (um) => um.mission_id === missionId && (um.user_id === userId || mission.is_cooperative),
      );
      if (already) {
        return Promise.resolve({ data: { ok: false, error: "missao_em_curso" }, error: null });
      }
      const um: UserMission = {
        id: newId(),
        user_id: mission.is_cooperative ? null : userId,
        mission_id: missionId,
        current_progress: 0,
        status: "in_progress",
        started_at: now(),
        completed_at: null,
        available_until: null,
        points_awarded: 0,
        next_available_at: null,
      };
      USER_MISSIONS.push(um);
      return Promise.resolve({ data: { ok: true, user_mission_id: um.id }, error: null });
    }

    available.status = "in_progress";
    available.started_at = now();
    available.completed_at = null;
    return Promise.resolve({ data: { ok: true, user_mission_id: available.id }, error: null });
  }

  if (fn === "roll_missions") {
    const nowIso = now();
    const nowMs = Date.now();
    let availableExpired = 0;
    let partialCount = 0;
    let partialPoints = 0;
    let expired = 0;
    let renewed = 0;

    // 1) Temporárias disponíveis sem ativação: somem (voltam aleatoriamente depois).
    for (const um of USER_MISSIONS) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || !mission.is_temporary || um.status !== "available") continue;
      if (um.available_until && new Date(um.available_until) < new Date(nowMs)) {
        um.status = "failed";
        um.completed_at = nowIso;
        um.next_available_at = daysFromNow(2 + Math.floor(Math.random() * 6));
        availableExpired++;
      }
    }

    // 2) Temporárias ativadas e não concluídas a tempo: pontos proporcionais.
    for (const um of USER_MISSIONS) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || !mission.is_temporary || um.status !== "in_progress") continue;
      const durationDeadline = new Date(um.started_at);
      durationDeadline.setDate(durationDeadline.getDate() + mission.duration_days);
      const stayDeadline = um.available_until ? new Date(um.available_until) : durationDeadline;
      const deadline = stayDeadline > durationDeadline ? stayDeadline : durationDeadline;
      if (deadline >= new Date(nowMs)) continue;

      const partial = Math.floor(
        (um.current_progress / mission.target_value) * mission.reward_points,
      );
      if (partial > 0) {
        const targets = mission.is_cooperative
          ? PROFILES.map((p) => p.id)
          : um.user_id
            ? [um.user_id]
            : [];
        for (const id of targets) {
          const profile = PROFILES.find((p) => p.id === id);
          if (profile) {
            profile.points_balance += partial;
            profile.total_points_earned += partial;
          }
        }
      }

      um.status = "failed";
      um.completed_at = nowIso;
      um.points_awarded = partial;
      um.next_available_at = daysFromNow(2 + Math.floor(Math.random() * 6));
      partialCount++;
      partialPoints += partial;
    }

    // 3) Missões comuns ativadas e vencidas: falham sem pontos (voltam depois).
    //    Missões diárias voltam no dia seguinte; multi-dia após o próprio prazo.
    for (const um of USER_MISSIONS) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || mission.is_temporary || um.status !== "in_progress") continue;
      const deadline = new Date(um.started_at);
      deadline.setDate(deadline.getDate() + mission.duration_days);
      if (deadline < new Date(nowMs)) {
        um.status = "failed";
        um.completed_at = nowIso;
        um.next_available_at =
          mission.always_active || mission.duration_days === 1
            ? dayStartFromNow(1)
            : daysFromNow(mission.duration_days);
        expired++;
      }
    }

    // 4) Renovações: rodadas prontas (completed/failed) voltam.
    for (const um of [...USER_MISSIONS]) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || (um.status !== "completed" && um.status !== "failed")) continue;
      if (um.next_available_at && new Date(um.next_available_at) > new Date(nowMs)) continue;

      if (mission.always_active) {
        um.status = "in_progress";
      } else {
        um.status = "available";
        if (mission.is_temporary) {
          const min = Math.max(1, mission.stay_min_days || 1);
          const max = Math.max(min, mission.stay_max_days || 3);
          um.available_until = daysFromNow(min + Math.floor(Math.random() * (max - min + 1)));
        } else {
          um.available_until = null;
        }
      }
      um.current_progress = 0;
      um.started_at = nowIso;
      um.completed_at = null;
      um.next_available_at = null;
      um.points_awarded = 0;
      renewed++;
    }

    return Promise.resolve({
      data: {
        available_expired: availableExpired,
        partial_missions: partialCount,
        partial_points: partialPoints,
        expired,
        renewed,
      } as Json,
      error: null,
    });
  }

  return Promise.resolve({ data: null, error: { message: `RPC "${fn}" não implementada no mock.` } });
}

// -----------------------------------------------------------------------------
// Cliente mock
// -----------------------------------------------------------------------------

export const mockClient = {
  from(table: TableName) {
    return new MockBuilder(table);
  },
  rpc(fn: string, args?: Record<string, unknown>) {
    return rpcMock(fn, args);
  },
};
