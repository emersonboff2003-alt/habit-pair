-- =============================================================================
-- Habit Pair — Gamificação de hábitos para casal (Émerson & Ana)
-- Banco: Supabase (PostgreSQL)
-- Uso: rode este script no SQL Editor do Supabase (ou via `supabase db push`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos Enumerados
-- -----------------------------------------------------------------------------
CREATE TYPE log_type AS ENUM ('water', 'exercise', 'nutrition');
CREATE TYPE mission_status AS ENUM ('in_progress', 'completed', 'failed');
CREATE TYPE reward_status AS ENUM ('available', 'redeemed', 'fulfilled');

-- -----------------------------------------------------------------------------
-- Tabela de Usuários / Perfis
-- pin_hash é nullable: o acesso é por seleção de perfil (estilo Netflix),
-- sem fluxo de PIN/e-mail/senha.
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  pin_hash VARCHAR(255),
  points_balance INT DEFAULT 0 CHECK (points_balance >= 0),
  total_points_earned INT DEFAULT 0 CHECK (total_points_earned >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Registros Diários
-- value: ml para água, minutos para exercício, 1 (check-in) para nutrição.
-- description: para nutrição, guarda a categoria ('macros' | 'sweets' | 'meals').
-- points_earned é calculado pelo trigger handle_log_insert (respeitando tetos).
-- -----------------------------------------------------------------------------
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type log_type NOT NULL,
  value INT NOT NULL,
  points_earned INT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Catálogo de Missões
-- -----------------------------------------------------------------------------
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  target_type log_type NOT NULL,
  target_value INT NOT NULL,
  duration_days INT NOT NULL,
  reward_points INT NOT NULL,
  is_cooperative BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Missões do Usuário
-- user_id NULL quando a missão é cooperativa.
-- -----------------------------------------------------------------------------
CREATE TABLE user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL se cooperativa
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  current_progress INT DEFAULT 0,
  status mission_status DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- Loja de Recompensas
-- -----------------------------------------------------------------------------
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  cost_points INT NOT NULL CHECK (cost_points > 0),
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Histórico de Resgates
-- -----------------------------------------------------------------------------
CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status reward_status DEFAULT 'redeemed',
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX idx_logs_user_type_date ON logs (user_id, type, created_at DESC);
CREATE INDEX idx_logs_user_date ON logs (user_id, created_at DESC);
CREATE INDEX idx_user_missions_user_status ON user_missions (user_id, status);
CREATE INDEX idx_user_missions_mission_status ON user_missions (mission_id, status);
CREATE INDEX idx_redemptions_user ON redemptions (user_id, redeemed_at DESC);

-- =============================================================================
-- Funções utilitárias de gamificação (usadas pelos triggers/RPCs)
-- =============================================================================

-- Pontos brutos por registro, sem teto diário.
-- Água:      +10 pontos a cada 500ml
-- Exercício: +1 ponto por minuto
-- Nutrição:  macros=+50 | sweets=+30 | meals=+20 (1 check-in por categoria/dia)
CREATE OR REPLACE FUNCTION gamification_raw_points(p_type log_type, p_value INT, p_description TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'water' THEN (p_value / 500) * 10
    WHEN 'exercise' THEN p_value
    WHEN 'nutrition' THEN
      CASE p_description
        WHEN 'macros' THEN 50
        WHEN 'sweets' THEN 30
        WHEN 'meals' THEN 20
        ELSE 0
      END
    ELSE 0
  END;
$$;

-- Teto diário de pontos por tipo.
CREATE OR REPLACE FUNCTION gamification_daily_cap(p_type log_type)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'water' THEN 50
    WHEN 'exercise' THEN 90
    WHEN 'nutrition' THEN 100
    ELSE 0
  END;
$$;

-- =============================================================================
-- Trigger: motor de progresso de missões + crédito de pontos ao inserir log
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_log_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_already_today INT;
  v_cap INT;
  v_raw INT;
  v_mission RECORD;
  v_profile RECORD;
BEGIN
  -- 1) Nutrição: permitido apenas 1 registro por categoria por dia.
  IF NEW.type = 'nutrition' THEN
    IF EXISTS (
      SELECT 1 FROM logs
      WHERE user_id = NEW.user_id
        AND type = 'nutrition'
        AND description = NEW.description
        AND created_at >= date_trunc('day', NOW())
    ) THEN
      RAISE EXCEPTION 'nutricao_duplicada: Check-in nutricional já registrado hoje para esta categoria.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 2) Pontos respeitando o teto diário do tipo.
  SELECT COALESCE(SUM(points_earned), 0)
    INTO v_already_today
    FROM logs
   WHERE user_id = NEW.user_id
     AND type = NEW.type
     AND created_at >= date_trunc('day', NOW());

  v_cap := gamification_daily_cap(NEW.type);
  v_raw := gamification_raw_points(NEW.type, NEW.value, NEW.description);
  NEW.points_earned := GREATEST(LEAST(v_raw, v_cap - v_already_today), 0);

  -- 3) Motor de missões: incrementa progresso nas missões ativas do tipo.
  FOR v_mission IN
    SELECT um.id AS um_id, m.id AS mission_id, m.target_value, m.reward_points,
           m.is_cooperative, um.user_id AS um_user_id, um.current_progress
      FROM user_missions um
      JOIN missions m ON m.id = um.mission_id
     WHERE m.target_type = NEW.type
       AND um.status = 'in_progress'
       AND m.is_active = TRUE
       AND (um.user_id = NEW.user_id OR um.user_id IS NULL)
  LOOP
    UPDATE user_missions
       SET current_progress = current_progress + NEW.value
     WHERE id = v_mission.um_id
     RETURNING current_progress INTO v_mission.current_progress;

    IF v_mission.current_progress >= v_mission.target_value THEN
      UPDATE user_missions
         SET status = 'completed',
             completed_at = NOW()
       WHERE id = v_mission.um_id;

      -- Credita pontos da missão ao(s) perfil(is).
      -- Individual: usuário dono da missão. Cooperativa: TODOS os perfis.
      IF v_mission.is_cooperative THEN
        FOR v_profile IN SELECT id FROM profiles LOOP
          UPDATE profiles
             SET points_balance = points_balance + v_mission.reward_points,
                 total_points_earned = total_points_earned + v_mission.reward_points
           WHERE id = v_profile.id;
        END LOOP;
      ELSE
        UPDATE profiles
           SET points_balance = points_balance + v_mission.reward_points,
               total_points_earned = total_points_earned + v_mission.reward_points
         WHERE id = v_mission.um_user_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_insert ON logs;
CREATE TRIGGER trg_log_insert
  BEFORE INSERT ON logs
  FOR EACH ROW EXECUTE FUNCTION handle_log_insert();

-- =============================================================================
-- RPC: resgate atômico de recompensa
-- -----------------------------------------------------------------------------
-- Verifica saldo, deduz e insere o resgate em uma única transação.
-- Retorna JSONB com { ok, redemption_id, new_balance } ou { ok: false, error }.
-- =============================================================================
CREATE OR REPLACE FUNCTION redeem_reward(p_user_id UUID, p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cost INT;
  v_balance INT;
  v_redemption_id UUID;
BEGIN
  SELECT cost_points INTO v_cost FROM rewards WHERE id = p_reward_id;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'reward_not_found');
  END IF;

  SELECT points_balance INTO v_balance
    FROM profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'user_not_found');
  END IF;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'insufficient_points');
  END IF;

  UPDATE profiles SET points_balance = points_balance - v_cost WHERE id = p_user_id;

  INSERT INTO redemptions (reward_id, user_id, status)
  VALUES (p_reward_id, p_user_id, 'redeemed')
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'redemption_id', v_redemption_id,
    'new_balance', v_balance - v_cost
  );
END;
$$;

-- =============================================================================
-- RPC: cron — expira missões que passaram do prazo (duration_days)
-- Retorna a quantidade de missões marcadas como 'failed'.
-- =============================================================================
CREATE OR REPLACE FUNCTION expire_stale_missions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE user_missions um
       SET status = 'failed'
      FROM missions m
     WHERE um.mission_id = m.id
       AND um.status = 'in_progress'
       AND um.started_at + make_interval(days => m.duration_days) < NOW()
     RETURNING um.id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- RPC: cron — renova missões diárias (duration_days = 1)
-- Reseta missões de um dia já concluídas/falhadas para a nova rodada do dia.
-- Retorna a quantidade de missões renovadas.
-- =============================================================================
CREATE OR REPLACE FUNCTION renew_daily_missions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH renewed AS (
    UPDATE user_missions um
       SET status = 'in_progress',
           current_progress = 0,
           started_at = NOW(),
           completed_at = NULL
      FROM missions m
     WHERE um.mission_id = m.id
       AND m.duration_days = 1
       AND um.status IN ('completed', 'failed')
       AND um.started_at::date < CURRENT_DATE
     RETURNING um.id
  )
  SELECT COUNT(*) INTO v_count FROM renewed;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Todas as mutações acontecem no servidor (service role, que ignora RLS).
-- Anon tem somente leitura pública do catálogo necessário ao app.
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_anon_read" ON profiles;
CREATE POLICY "profiles_anon_read" ON profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "missions_anon_read" ON missions;
CREATE POLICY "missions_anon_read" ON missions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "rewards_anon_read" ON rewards;
CREATE POLICY "rewards_anon_read" ON rewards FOR SELECT USING (TRUE);

-- logs, user_missions e redemptions ficam exclusivamente server-side (sem policy anon).

-- =============================================================================
-- Seeds de teste
-- =============================================================================

-- Perfis (pin_hash NULL — acesso por seleção de perfil)
INSERT INTO profiles (id, name, pin_hash, points_balance, total_points_earned) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Émerson', NULL, 0, 0),
  ('a0000000-0000-0000-0000-000000000002', 'Ana',    NULL, 0, 0);

-- Catálogo de missões
INSERT INTO missions (id, title, description, target_type, target_value, duration_days, reward_points, is_cooperative, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000001',
   'Água do dia', 'Beba 2500ml de água hoje.', 'water', 2500, 1, 50, FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000002',
   'Treino do dia', 'Complete 90 minutos de atividade física hoje.', 'exercise', 90, 1, 90, FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000003',
   'Nutrição completa', 'Bata a meta de calorias, limite de doces e registre as refeições.', 'nutrition', 3, 1, 100, FALSE, TRUE),
  ('b0000000-0000-0000-0000-000000000004',
   'Hidratação em dupla (semana)', 'Juntos, bebam 17.500ml (2500ml/dia cada) em 7 dias.', 'water', 17500, 7, 200, TRUE, TRUE);

-- Missões iniciais dos usuários
INSERT INTO user_missions (user_id, mission_id, current_progress, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 0, 'in_progress'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 0, 'in_progress'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 0, 'in_progress'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 0, 'in_progress'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 0, 'in_progress'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 0, 'in_progress'),
  -- Cooperativa (user_id NULL)
  (NULL, 'b0000000-0000-0000-0000-000000000004', 0, 'in_progress');

-- Loja de recompensas
INSERT INTO rewards (id, title, description, cost_points, created_by) VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'Jantar fora à escolha do outro', 'O(a) parceiro(a) escolhe o restaurante.', 150, NULL),
  ('c0000000-0000-0000-0000-000000000002',
   'Massagem de 30 minutos', 'Sessão de massagem relaxante oferecida pelo(a) parceiro(a).', 120, NULL),
  ('c0000000-0000-0000-0000-000000000003',
   'Sessão Netflix + pizza', 'Escolha o filme/série e a pizza do dia.', 80, NULL),
  ('c0000000-0000-0000-0000-000000000004',
   'Manhã livre sem tarefas', 'Um período da manhã inteira sem afazeres domésticos.', 100, NULL);
