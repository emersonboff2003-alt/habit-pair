// =============================================================================
// Cliente Supabase mock (em memória) para desenvolvimento/teste sem backend.
//
// Ativo automaticamente quando NEXT_PUBLIC_SUPABASE_URL não está configurada
// (ou quando NEXT_PUBLIC_MOCK_MODE=true). Espelha o schema.sql:
//   - perfis Émerson & Ana, missões e recompensas seedadas
//   - regras de gamificação do trigger handle_log_insert (pontos, tetos,
//     nutrição única/dia, progresso de missões + crédito de pontos)
//   - RPC redeem_reward (resgate atômico), expire/renew de missões
//
// IMPORTANTE: os dados ficam em memória no processo do servidor Next e são
// zerados a cada restart do `npm run dev`.
// =============================================================================

import type {
  Json,
  Log,
  LogType,
  Mission,
  Profile,
  Redemption,
  Reward,
  UserMission,
} from "@/types/database";
import { calcPointsForLog, dailyCapFor } from "@/lib/gamification";

export function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_MOCK_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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
    theme: "pink-dark",
    created_at: now(),
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "Ana",
    pin_hash: null,
    points_balance: 60,
    total_points_earned: 60,
    theme: "blue-light",
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
    created_at: now(),
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    title: "Nutrição completa",
    description: "Bata a meta de calorias, limite de doces e registre as refeições.",
    target_type: "nutrition",
    target_value: 3,
    duration_days: 1,
    reward_points: 100,
    is_cooperative: false,
    is_active: true,
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
    created_at: now(),
  },
];

const USER_MISSIONS: UserMission[] = [
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000001",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000002",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000001",
    mission_id: "b0000000-0000-0000-0000-000000000003",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000001",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000002",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
  },
  {
    id: newId(),
    user_id: "a0000000-0000-0000-0000-000000000002",
    mission_id: "b0000000-0000-0000-0000-000000000003",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
  },
  {
    id: newId(),
    user_id: null,
    mission_id: "b0000000-0000-0000-0000-000000000004",
    current_progress: 0,
    status: "in_progress",
    started_at: now(),
    completed_at: null,
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
];

const LOGS: Log[] = [];
const REDEMPTIONS: Redemption[] = [];

type TableName = "profiles" | "logs" | "missions" | "user_missions" | "rewards" | "redemptions";

type Store = Record<TableName, Record<string, unknown>[]>;

function getStore(): Store {
  return {
    profiles: PROFILES as unknown as Record<string, unknown>[],
    logs: LOGS as unknown as Record<string, unknown>[],
    missions: MISSIONS as unknown as Record<string, unknown>[],
    user_missions: USER_MISSIONS as unknown as Record<string, unknown>[],
    rewards: REWARDS as unknown as Record<string, unknown>[],
    redemptions: REDEMPTIONS as unknown as Record<string, unknown>[],
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

  // 1) Nutrição: apenas 1 registro por categoria por dia.
  if (type === "nutrition") {
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
  const alreadyToday = LOGS.filter(
    (l) => l.user_id === user_id && l.type === type && l.created_at >= startOfToday(),
  ).reduce((sum, l) => sum + l.points_earned, 0);
  const cap = dailyCapFor(type);
  const raw = calcPointsForLog(type, value, description);
  const pointsEarned = Math.max(0, Math.min(raw, cap - alreadyToday));

  const log: Log = {
    id: newId(),
    user_id,
    type,
    value,
    points_earned: pointsEarned,
    description,
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
          relTable === "missions" ? "mission_id" : relTable === "rewards" ? "reward_id" : undefined;
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
  private mode: "select" | "insert" | "update";
  private payload?: Row;
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

  single<T>() {
    this.singleMode = "single";
    return this as unknown as MockBuilder;
  }

  maybeSingle<T>() {
    this.singleMode = "maybe";
    return this as unknown as MockBuilder;
  }

  insert(payload: Row) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
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

function rpcMock(
  fn: string,
  args?: { p_user_id?: string; p_reward_id?: string },
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

  if (fn === "expire_stale_missions") {
    let count = 0;
    for (const um of USER_MISSIONS) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || um.status !== "in_progress") continue;
      const deadline = new Date(um.started_at);
      deadline.setDate(deadline.getDate() + mission.duration_days);
      if (deadline < new Date()) {
        um.status = "failed";
        count++;
      }
    }
    return Promise.resolve({ data: count, error: null });
  }

  if (fn === "renew_daily_missions") {
    let count = 0;
    for (const um of USER_MISSIONS) {
      const mission = MISSIONS.find((m) => m.id === um.mission_id);
      if (!mission || mission.duration_days !== 1) continue;
      if ((um.status === "completed" || um.status === "failed") && um.started_at.slice(0, 10) < now().slice(0, 10)) {
        um.status = "in_progress";
        um.current_progress = 0;
        um.started_at = now();
        um.completed_at = null;
        count++;
      }
    }
    return Promise.resolve({ data: count, error: null });
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
  rpc(fn: string, args?: { p_user_id?: string; p_reward_id?: string }) {
    return rpcMock(fn, args);
  },
};
