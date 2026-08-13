-- =============================================================================
-- Habit Pair - Gamificação de hábitos para casal (Émerson & Ana)
-- Banco: Supabase (PostgreSQL)
-- Uso: rode este script no SQL Editor do Supabase (ou via `supabase db push`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos Enumerados
-- -----------------------------------------------------------------------------
CREATE TYPE log_type AS ENUM ('water', 'exercise', 'nutrition');
CREATE TYPE mission_status AS ENUM ('available', 'in_progress', 'completed', 'failed');
CREATE TYPE reward_status AS ENUM ('available', 'redeemed', 'fulfilled');
CREATE TYPE meal_slot AS ENUM ('breakfast', 'lunch', 'afternoon', 'dinner');

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
  theme VARCHAR(30) NOT NULL DEFAULT 'classic-dark',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Registros Diários
-- value: ml para água, minutos para exercício, nº de itens para refeições.
-- description: para refeições, guarda 'meal:<slot>:<meal_log_id>[:quick]';
--              para exercício rápido, 'quick'; detalhado pode guardar a distância.
-- exercise_type_id: modalidade do exercício (NULL para treino rápido ou outros tipos).
-- points_earned é calculado pelo trigger handle_log_insert (respeitando tetos),
-- exceto para refeições e treino rápido, onde o valor vem do servidor.
-- -----------------------------------------------------------------------------
CREATE TABLE exercise_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type log_type NOT NULL,
  value INT NOT NULL,
  points_earned INT NOT NULL DEFAULT 0,
  description TEXT,
  exercise_type_id UUID REFERENCES exercise_types(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Catálogo de Alimentos (utilizado na refeição detalhada)
-- points: pontos por 1 porção do alimento.
-- -----------------------------------------------------------------------------
CREATE TABLE food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  category VARCHAR(40) NOT NULL,
  points INT NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Refeições registradas (rápidas ou detalhadas)
-- -----------------------------------------------------------------------------
CREATE TABLE meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  slot meal_slot NOT NULL,
  is_quick BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal_log_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id UUID REFERENCES meal_logs(id) ON DELETE CASCADE NOT NULL,
  food_item_id UUID REFERENCES food_items(id) ON DELETE RESTRICT,
  custom_name VARCHAR(80),
  portion INT NOT NULL DEFAULT 1,
  points INT NOT NULL,
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
  always_active BOOLEAN DEFAULT FALSE,
  is_temporary BOOLEAN DEFAULT FALSE,
  stay_min_days INT DEFAULT 1,
  stay_max_days INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Missões do Usuário
-- user_id NULL quando a missão é cooperativa.
-- status 'available' = visível mas desativada (aguardando ativação manual).
-- -----------------------------------------------------------------------------
CREATE TABLE user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL se cooperativa
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,
  current_progress INT DEFAULT 0,
  status mission_status DEFAULT 'available',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  points_awarded INT DEFAULT 0,
  next_available_at TIMESTAMPTZ
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
CREATE INDEX idx_meal_logs_user_date ON meal_logs (user_id, created_at DESC);
CREATE INDEX idx_meal_log_items_meal ON meal_log_items (meal_log_id);
CREATE INDEX idx_meal_logs_quick_slot ON meal_logs (user_id, slot, is_quick, created_at DESC);

-- =============================================================================
-- Funções utilitárias de gamificação (usadas pelos triggers/RPCs)
-- =============================================================================

-- Pontos brutos por registro, sem teto diário.
-- Água:      +10 pontos a cada 500ml
-- Exercício: +1 ponto por minuto (detalhado; o rápido usa valor do servidor)
-- Nutrição:  refeições usam o valor calculado no servidor (não passa por aqui)
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

-- Início do dia no fuso brasileiro (America/Sao_Paulo) como TIMESTAMPTZ.
-- Sem isso, "hoje" começava à meia-noite UTC (21h do dia anterior no Brasil),
-- fazendo registros noturnos contarem no dia errado e o teto diário virar
-- em horário errado.
CREATE OR REPLACE FUNCTION day_start_br()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT (date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
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
  -- Serializa inserções concorrentes do mesmo perfil (evita condição de corrida
  -- no teto diário) travando a linha do perfil.
  PERFORM 1 FROM profiles WHERE id = NEW.user_id FOR UPDATE;

  -- 1) Nutrição: apenas 1 registro por categoria por dia (macros/sweets/meals).
  --    Refeições (description 'meal:...') não passam por esta regra: múltiplas
  --    refeições detalhadas por dia são permitidas e o rápido é validado na RPC.
  IF NEW.type = 'nutrition'
     AND NEW.description NOT LIKE 'meal:%'
     AND EXISTS (
       SELECT 1 FROM logs
       WHERE user_id = NEW.user_id
         AND type = 'nutrition'
         AND description = NEW.description
         AND created_at >= day_start_br()
     ) THEN
    RAISE EXCEPTION 'nutricao_duplicada: Check-in nutricional já registrado hoje para esta categoria.'
      USING ERRCODE = 'P0001';
  END IF;

   -- 2) Pontos respeitando o teto diário do tipo.
   --    Refeições (meal:*) e treino rápido ('quick') chegam com pontos já
   --    calculados no servidor; os demais tipos são calculados aqui.
   SELECT COALESCE(SUM(points_earned), 0)
     INTO v_already_today
     FROM logs
    WHERE user_id = NEW.user_id
      AND type = NEW.type
      AND created_at >= day_start_br();

  v_cap := gamification_daily_cap(NEW.type);
  IF (NEW.type = 'nutrition' AND NEW.description LIKE 'meal:%')
     OR (NEW.type = 'exercise' AND NEW.description = 'quick') THEN
    v_raw := NEW.points_earned;
  ELSE
    v_raw := gamification_raw_points(NEW.type, NEW.value, NEW.description);
  END IF;
  NEW.points_earned := GREATEST(LEAST(v_raw, v_cap - v_already_today), 0);

  -- 3) Credita os pontos do registro no saldo do perfil.
  IF NEW.points_earned > 0 THEN
    UPDATE profiles
       SET points_balance = points_balance + NEW.points_earned,
           total_points_earned = total_points_earned + NEW.points_earned
     WHERE id = NEW.user_id;
  END IF;

  -- 4) Motor de missões: incrementa progresso nas missões ativas do tipo.
  FOR v_mission IN
    SELECT um.id AS um_id, m.id AS mission_id, m.target_value, m.reward_points,
           m.is_cooperative, m.always_active, m.is_temporary, m.duration_days,
           um.user_id AS um_user_id, um.current_progress
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
             completed_at = NOW(),
             points_awarded = v_mission.reward_points,
               next_available_at = CASE
                 WHEN v_mission.always_active OR v_mission.duration_days = 1
                   THEN day_start_br() + interval '1 day'
               WHEN v_mission.is_temporary
                 THEN NOW() + ((2 + floor(random() * 6))::int) * interval '1 day'
               ELSE NOW() + make_interval(days => v_mission.duration_days)
             END
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
-- RPC: registro atômico de refeição (rápida ou detalhada)
-- -----------------------------------------------------------------------------
-- Calcula os pontos no servidor (nunca confia no cliente), insere meal_logs,
-- meal_log_items e o log de nutrição (que dispara o trigger de gamificação)
-- em uma única transação.
-- Retorna JSONB com { ok, points_earned, meal_log_id } ou { ok: false, error }.
-- =============================================================================
CREATE OR REPLACE FUNCTION insert_meal_log(
  p_user_id UUID,
  p_slot meal_slot,
  p_is_quick BOOLEAN,
  p_items JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_meal_log_id UUID;
  v_points INT := 0;
  v_count INT := 0;
  v_log RECORD;
  v_item JSONB;
  v_food_id UUID;
  v_custom TEXT;
  v_portion INT;
  v_item_points INT;
BEGIN
  -- Validações
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'user_not_found');
  END IF;

  IF p_is_quick THEN
    -- Ref. rápida: apenas 1 por slot/dia e vale pontos fixos.
    IF EXISTS (
      SELECT 1 FROM meal_logs
       WHERE user_id = p_user_id
         AND slot = p_slot
         AND is_quick = TRUE
         AND created_at >= day_start_br()
    ) THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'refeicao_rapida_duplicada');
    END IF;
    v_count := 1;
    v_points := 10; -- Ref. rápida: pontos fixos (abaixo de uma detalhada).
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'sem_itens');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_food_id := (v_item->>'food_item_id')::uuid;
      v_custom := v_item->>'custom_name';
      v_portion := COALESCE((v_item->>'portion')::int, 1);
      IF v_portion < 1 THEN v_portion := 1; END IF;

      IF (v_item ? 'food_item_id') AND v_food_id IS NOT NULL THEN
        SELECT points INTO v_item_points FROM food_items WHERE id = v_food_id AND is_active = TRUE;
        IF v_item_points IS NULL THEN
          RETURN jsonb_build_object('ok', FALSE, 'error', 'item_invalido');
        END IF;
      ELSE
        -- Item livre (fora do catálogo): pontos padrão.
        v_item_points := 5;
      END IF;

      v_points := v_points + v_item_points * v_portion;
      v_count := v_count + 1;
    END LOOP;

    -- Bônus de "refeição completa" (3+ itens).
    IF v_count >= 3 THEN
      v_points := v_points + 10;
    END IF;
  END IF;

  INSERT INTO meal_logs (user_id, slot, is_quick)
  VALUES (p_user_id, p_slot, p_is_quick)
  RETURNING id INTO v_meal_log_id;

  IF NOT p_is_quick THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_food_id := (v_item->>'food_item_id')::uuid;
      v_custom := v_item->>'custom_name';
      v_portion := COALESCE((v_item->>'portion')::int, 1);
      IF v_portion < 1 THEN v_portion := 1; END IF;

      IF (v_item ? 'food_item_id') AND v_food_id IS NOT NULL THEN
        SELECT points INTO v_item_points FROM food_items WHERE id = v_food_id;
      ELSE
        v_item_points := 5;
      END IF;

      INSERT INTO meal_log_items (meal_log_id, food_item_id, custom_name, portion, points)
      VALUES (v_meal_log_id, v_food_id, v_custom, v_portion, v_item_points * v_portion);
    END LOOP;
  END IF;

  -- Log de nutrição (dispara o trigger de pontuação/missões).
  INSERT INTO logs (user_id, type, value, points_earned, description)
  VALUES (
    p_user_id,
    'nutrition',
    v_count,
    v_points,
    'meal:' || p_slot::text || ':' || v_meal_log_id || CASE WHEN p_is_quick THEN ':quick' ELSE '' END
  )
  RETURNING * INTO v_log;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'points_earned', v_log.points_earned,
    'meal_log_id', v_meal_log_id
  );
END;
$$;

-- =============================================================================
-- RPC: registro atômico de exercício (detalhado ou rápido)
-- -----------------------------------------------------------------------------
-- Detalhado: 1 pt/minuto (teto diário aplicado pelo trigger), modalidade obrigatória.
-- Rápido:    20 pts fixos, equivale a 30 min para o progresso de missões.
-- Retorna JSONB com { ok, points_earned } ou { ok: false, error }.
-- =============================================================================
CREATE OR REPLACE FUNCTION insert_exercise_log(
  p_user_id UUID,
  p_exercise_type_id UUID DEFAULT NULL,
  p_minutes INT DEFAULT NULL,
  p_distance TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points INT;
  v_description TEXT;
  v_value INT;
  v_log RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'user_not_found');
  END IF;

  IF p_exercise_type_id IS NULL THEN
    -- Treino rápido (genérico): 1 por dia, pontos fixos.
    IF EXISTS (
      SELECT 1 FROM logs
       WHERE user_id = p_user_id
         AND type = 'exercise'
         AND description = 'quick'
         AND created_at >= day_start_br()
    ) THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'treino_rapido_duplicado');
    END IF;
    v_points := 20; -- Treino rápido: pontos fixos.
    v_value := 30;  -- Equivalência em minutos para o progresso de missões.
    v_description := 'quick';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM exercise_types WHERE id = p_exercise_type_id AND is_active = TRUE) THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'tipo_exercicio_invalido');
    END IF;
    IF p_minutes IS NULL OR p_minutes <= 0 OR p_minutes > 600 THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'minutos_invalidos');
    END IF;
    v_points := p_minutes;
    v_value := p_minutes;
    v_description := p_distance; -- opcional: distância percorrida (ex.: '5 km')
  END IF;

  INSERT INTO logs (user_id, type, value, points_earned, description, exercise_type_id)
  VALUES (p_user_id, 'exercise', v_value, v_points, v_description, p_exercise_type_id)
  RETURNING * INTO v_log;

  RETURN jsonb_build_object('ok', TRUE, 'points_earned', v_log.points_earned);
END;
$$;

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
-- RPC: desfaz/exclui um registro (log) do usuário
-- -----------------------------------------------------------------------------
-- Reverte os pontos creditados no perfil, recua o progresso das missões em
-- andamento do mesmo tipo e apaga o log. Se for refeição (meal:*), também
-- apaga o meal_logs (com cascade nos itens).
-- Retorna JSONB com { ok, points_reverted, new_balance } ou { ok: false, error }.
-- Limitação v1: missões já 'completed' não são revertidas (evita corromper
-- pontos de recompensa já creditados).
-- =============================================================================
CREATE OR REPLACE FUNCTION delete_log(p_user_id UUID, p_log_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log RECORD;
  v_balance INT;
  v_meal_log_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_log_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'parametros_invalidos');
  END IF;

  -- Serializa com o trigger de insert (trava a linha do perfil).
  PERFORM 1 FROM profiles WHERE id = p_user_id FOR UPDATE;

  SELECT * INTO v_log FROM logs WHERE id = p_log_id AND user_id = p_user_id;
  IF v_log.id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'registro_nao_encontrado');
  END IF;

  -- 1) Reverte os pontos do registro no saldo do perfil.
  IF v_log.points_earned > 0 THEN
    UPDATE profiles
       SET points_balance = GREATEST(points_balance - v_log.points_earned, 0),
           total_points_earned = GREATEST(total_points_earned - v_log.points_earned, 0)
     WHERE id = p_user_id;
  END IF;

  -- 2) Recua o progresso das missões em andamento do mesmo tipo.
  UPDATE user_missions
     SET current_progress = GREATEST(current_progress - v_log.value, 0)
   WHERE status = 'in_progress'
     AND (user_id = p_user_id OR user_id IS NULL)
     AND mission_id IN (
       SELECT id FROM missions WHERE target_type = v_log.type AND is_active = TRUE
     );

  -- 3) Se for refeição, apaga o meal_logs (cascade remove os itens).
  IF v_log.description LIKE 'meal:%' THEN
    BEGIN
      v_meal_log_id := split_part(v_log.description, ':', 3)::uuid;
    EXCEPTION WHEN others THEN
      v_meal_log_id := NULL;
    END;
    IF v_meal_log_id IS NOT NULL THEN
      DELETE FROM meal_logs WHERE id = v_meal_log_id AND user_id = p_user_id;
    END IF;
  END IF;

  -- 4) Apaga o log.
  DELETE FROM logs WHERE id = p_log_id;

  SELECT points_balance INTO v_balance FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'points_reverted', v_log.points_earned,
    'new_balance', COALESCE(v_balance, 0)
  );
END;
$$;

-- =============================================================================
-- RPC: gira o ciclo de missões (cron diário /api/cron/check-missions)
-- -----------------------------------------------------------------------------
-- 1) Temporárias que ficaram 'available' sem ativação até available_until: somem
--    (ficam 'failed' e retornam aleatoriamente dias depois).
-- 2) Temporárias ativadas ('in_progress') que passaram do prazo sem concluir:
--    creditam pontos proporcionais ao progresso e saem da aba.
-- 3) Missões comuns ativadas que venceram (started_at + duration_days): falham
--    sem pontos (pontos proporcionais são exclusivos de temporárias).
-- 4) Missões concluídas/falhas prontas (next_available_at vencido) voltam:
--    água sempre ativa volta como 'in_progress'; demais voltam 'available'
--    (temporárias com available_until aleatório no intervalo stay_min..stay_max).
-- Retorna JSONB com estatísticas da rodada.
-- =============================================================================
CREATE OR REPLACE FUNCTION roll_missions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_expired INT := 0;
  v_partial_count INT := 0;
  v_partial_points INT := 0;
  v_expired INT := 0;
  v_renewed INT := 0;
  v_um RECORD;
  v_partial INT;
  v_profile RECORD;
BEGIN
  -- 1) Temporárias disponíveis que ninguém ativou: somem da aba.
  UPDATE user_missions um
     SET status = 'failed',
         completed_at = NOW(),
         next_available_at = NOW() + ((2 + floor(random() * 6))::int) * interval '1 day'
    FROM missions m
   WHERE um.mission_id = m.id
     AND m.is_temporary = TRUE
     AND um.status = 'available'
     AND um.available_until IS NOT NULL
     AND um.available_until < NOW();
  GET DIAGNOSTICS v_available_expired = ROW_COUNT;

  -- 2) Temporárias ativadas que não concluíram a tempo: pontos proporcionais.
  FOR v_um IN
    SELECT um.id, um.user_id, um.current_progress,
           m.target_value, m.reward_points, m.is_cooperative, m.duration_days,
           COALESCE(um.available_until, um.started_at + make_interval(days => m.duration_days))
             AS deadline
      FROM user_missions um
      JOIN missions m ON m.id = um.mission_id
     WHERE m.is_temporary = TRUE
       AND um.status = 'in_progress'
       AND GREATEST(
             COALESCE(um.available_until, um.started_at + make_interval(days => m.duration_days)),
             um.started_at + make_interval(days => m.duration_days)
           ) < NOW()
  LOOP
    v_partial := FLOOR(
      v_um.current_progress::numeric / v_um.target_value::numeric * v_um.reward_points::numeric
    )::int;

    IF v_partial > 0 THEN
      IF v_um.is_cooperative THEN
        FOR v_profile IN SELECT id FROM profiles LOOP
          UPDATE profiles
             SET points_balance = points_balance + v_partial,
                 total_points_earned = total_points_earned + v_partial
           WHERE id = v_profile.id;
        END LOOP;
      ELSE
        UPDATE profiles
           SET points_balance = points_balance + v_partial,
               total_points_earned = total_points_earned + v_partial
         WHERE id = v_um.user_id;
      END IF;
    END IF;

    UPDATE user_missions
       SET status = 'failed',
           completed_at = NOW(),
           points_awarded = v_partial,
           next_available_at = NOW() + ((2 + floor(random() * 6))::int) * interval '1 day'
     WHERE id = v_um.id;

    v_partial_count := v_partial_count + 1;
    v_partial_points := v_partial_points + v_partial;
  END LOOP;

  -- 3) Missões comuns ativadas e vencidas: falham sem pontos.
  --    Missões diárias voltam no dia seguinte; multi-dia após o próprio prazo.
  UPDATE user_missions um
     SET status = 'failed',
         completed_at = NOW(),
         next_available_at = CASE
           WHEN m.always_active OR m.duration_days = 1
             THEN day_start_br() + interval '1 day'
           ELSE NOW() + make_interval(days => m.duration_days)
         END
    FROM missions m
   WHERE um.mission_id = m.id
     AND m.is_temporary = FALSE
     AND um.status = 'in_progress'
     AND um.started_at + make_interval(days => m.duration_days) < NOW();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- 4) Renovações: rodadas concluídas/falhas prontas para voltar.
  FOR v_um IN
    SELECT um.id,
           m.always_active, m.is_temporary,
           GREATEST(COALESCE(m.stay_min_days, 1), 1) AS stay_min,
           GREATEST(COALESCE(m.stay_max_days, 3), 1) AS stay_max
      FROM user_missions um
      JOIN missions m ON m.id = um.mission_id
     WHERE um.status IN ('completed', 'failed')
       AND COALESCE(um.next_available_at, NOW()) <= NOW()
  LOOP
    IF v_um.always_active THEN
      UPDATE user_missions
         SET status = 'in_progress',
             current_progress = 0,
             started_at = NOW(),
             completed_at = NULL,
             available_until = NULL,
             next_available_at = NULL,
             points_awarded = 0
       WHERE id = v_um.id;
    ELSIF v_um.is_temporary THEN
      UPDATE user_missions
         SET status = 'available',
             current_progress = 0,
             started_at = NOW(),
             completed_at = NULL,
             available_until = NOW()
               + (v_um.stay_min + floor(random() * (v_um.stay_max - v_um.stay_min + 1))::int)
                 * interval '1 day',
             next_available_at = NULL,
             points_awarded = 0
       WHERE id = v_um.id;
    ELSE
      UPDATE user_missions
         SET status = 'available',
             current_progress = 0,
             started_at = NOW(),
             completed_at = NULL,
             available_until = NULL,
             next_available_at = NULL,
             points_awarded = 0
       WHERE id = v_um.id;
    END IF;
    v_renewed := v_renewed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'available_expired', v_available_expired,
    'partial_missions', v_partial_count,
    'partial_points', v_partial_points,
    'expired', v_expired,
    'renewed', v_renewed
  );
END;
$$;

-- =============================================================================
-- RPC: ativação manual de uma missão pelo usuário
-- -----------------------------------------------------------------------------
-- Só é possível ativar missão com status 'available'. Missões sempre ativas
-- (água) não precisam de ativação. Se não existir vínculo do usuário ainda,
-- cria a linha (individual ou a cooperativa compartilhada).
-- Retorna JSONB com { ok, user_mission_id } ou { ok: false, error }.
-- =============================================================================
CREATE OR REPLACE FUNCTION activate_mission(p_user_id UUID, p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission RECORD;
  v_um_id UUID;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'missao_nao_encontrada');
  END IF;
  IF v_mission.is_active = FALSE THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'missao_inativa');
  END IF;
  IF v_mission.always_active THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'missao_sempre_ativa');
  END IF;

  SELECT id INTO v_um_id
    FROM user_missions
   WHERE mission_id = p_mission_id
     AND status = 'available'
     AND (user_id = p_user_id OR (user_id IS NULL AND v_mission.is_cooperative))
   LIMIT 1;

  IF v_um_id IS NULL THEN
    -- Sem vínculo disponível: impede duplicatas e cria a rodada quando preciso.
    IF EXISTS (
      SELECT 1 FROM user_missions
       WHERE mission_id = p_mission_id
         AND (user_id = p_user_id OR v_mission.is_cooperative)
    ) THEN
      RETURN jsonb_build_object('ok', FALSE, 'error', 'missao_em_curso');
    END IF;

    INSERT INTO user_missions (user_id, mission_id, current_progress, status)
    VALUES (
      CASE WHEN v_mission.is_cooperative THEN NULL ELSE p_user_id END,
      p_mission_id,
      0,
      'in_progress'
    )
    RETURNING id INTO v_um_id;

    RETURN jsonb_build_object('ok', TRUE, 'user_mission_id', v_um_id);
  END IF;

  UPDATE user_missions
     SET status = 'in_progress',
         started_at = NOW(),
         completed_at = NULL
   WHERE id = v_um_id;

  RETURN jsonb_build_object('ok', TRUE, 'user_mission_id', v_um_id);
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
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_anon_read" ON profiles;
CREATE POLICY "profiles_anon_read" ON profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "missions_anon_read" ON missions;
CREATE POLICY "missions_anon_read" ON missions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "rewards_anon_read" ON rewards;
CREATE POLICY "rewards_anon_read" ON rewards FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "food_items_anon_read" ON food_items;
CREATE POLICY "food_items_anon_read" ON food_items FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "exercise_types_anon_read" ON exercise_types;
CREATE POLICY "exercise_types_anon_read" ON exercise_types FOR SELECT USING (TRUE);

-- logs, meal_logs, meal_log_items e redemptions ficam exclusivamente server-side (sem policy anon).

-- =============================================================================
-- Seeds de teste
-- =============================================================================

-- Perfis (pin_hash NULL — acesso por seleção de perfil)
INSERT INTO profiles (id, name, pin_hash, points_balance, total_points_earned) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Émerson', NULL, 0, 0),
  ('a0000000-0000-0000-0000-000000000002', 'Ana',    NULL, 0, 0);

-- Catálogo de alimentos
INSERT INTO food_items (id, name, category, points) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Arroz',           'grains',      10),
  ('d0000000-0000-0000-0000-000000000002', 'Arroz integral',  'grains',      12),
  ('d0000000-0000-0000-0000-000000000003', 'Feijão',          'grains',       8),
  ('d0000000-0000-0000-0000-000000000004', 'Pão integral',    'grains',       8),
  ('d0000000-0000-0000-0000-000000000005', 'Pão francês',     'grains',       5),
  ('d0000000-0000-0000-0000-000000000006', 'Tapioca',         'grains',       8),
  ('d0000000-0000-0000-0000-000000000007', 'Batata',          'grains',       7),
  ('d0000000-0000-0000-0000-000000000008', 'Macarrão',        'grains',       8),
  ('d0000000-0000-0000-0000-000000000009', 'Aveia',           'grains',      10),
  ('d0000000-0000-0000-0000-000000000010', 'Frango grelhado', 'protein',     15),
  ('d0000000-0000-0000-0000-000000000011', 'Carne bovina',    'protein',     15),
  ('d0000000-0000-0000-0000-000000000012', 'Peixe',           'protein',     15),
  ('d0000000-0000-0000-0000-000000000013', 'Ovo',             'protein',     10),
  ('d0000000-0000-0000-0000-000000000014', 'Lentilha',        'protein',     10),
  ('d0000000-0000-0000-0000-000000000015', 'Grão-de-bico',    'protein',     10),
  ('d0000000-0000-0000-0000-000000000016', 'Tofu',            'protein',     10),
  ('d0000000-0000-0000-0000-000000000017', 'Salada verde',    'vegetables',  10),
  ('d0000000-0000-0000-0000-000000000018', 'Brócolis',        'vegetables',  12),
  ('d0000000-0000-0000-0000-000000000019', 'Legumes no vapor','vegetables',  12),
  ('d0000000-0000-0000-0000-000000000020', 'Cenoura',         'vegetables',   8),
  ('d0000000-0000-0000-0000-000000000021', 'Tomate',          'vegetables',   5),
  ('d0000000-0000-0000-0000-000000000022', 'Abobrinha',       'vegetables',   8),
  ('d0000000-0000-0000-0000-000000000023', 'Fruta',           'fruits',       8),
  ('d0000000-0000-0000-0000-000000000024', 'Banana',          'fruits',       8),
  ('d0000000-0000-0000-0000-000000000025', 'Iogurte',         'dairy',        8),
  ('d0000000-0000-0000-0000-000000000026', 'Leite',           'dairy',        6),
  ('d0000000-0000-0000-0000-000000000027', 'Queijo',          'dairy',        8),
  ('d0000000-0000-0000-0000-000000000028', 'Café sem açúcar', 'beverages',    3),
  ('d0000000-0000-0000-0000-000000000029', 'Suco natural',    'beverages',    6),
  ('d0000000-0000-0000-0000-000000000030', 'Água de coco',    'beverages',    5),
  ('d0000000-0000-0000-0000-000000000031', 'Chocolate',       'sweets',       4),
  ('d0000000-0000-0000-0000-000000000032', 'Sobremesa',       'sweets',       4),
  ('d0000000-0000-0000-0000-000000000033', 'Refrigerante',    'sweets',       3),
  ('d0000000-0000-0000-0000-000000000034', 'Marmita caseira', 'ready_meals', 12),
  ('d0000000-0000-0000-0000-000000000035', 'Comida rápida',   'ready_meals',  3),
  ('d0000000-0000-0000-0000-000000000036', 'Pizza',           'ready_meals',  4);

-- Modalidades de exercício
INSERT INTO exercise_types (id, name) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Corrida'),
  ('e0000000-0000-0000-0000-000000000002', 'Caminhada'),
  ('e0000000-0000-0000-0000-000000000003', 'Musculação'),
  ('e0000000-0000-0000-0000-000000000004', 'Bicicleta'),
  ('e0000000-0000-0000-0000-000000000005', 'Natação'),
  ('e0000000-0000-0000-0000-000000000006', 'HIIT'),
  ('e0000000-0000-0000-0000-000000000007', 'Yoga e Pilates'),
  ('e0000000-0000-0000-0000-000000000008', 'Futebol'),
  ('e0000000-0000-0000-0000-000000000009', 'Basquete'),
  ('e0000000-0000-0000-0000-000000000010', 'Dança');

-- Catálogo de missões
-- always_active: água (fica sempre ativa e reseta todo dia).
-- is_temporary: missões de pontos altos que aparecem por um tempo e voltam
-- aleatoriamente (some se não ativadas; dá pontos proporcionais se ativadas
-- e não concluídas).
INSERT INTO missions (
  id, title, description, target_type, target_value, duration_days,
  reward_points, is_cooperative, is_active, always_active, is_temporary,
  stay_min_days, stay_max_days
) VALUES
  ('b0000000-0000-0000-0000-000000000001',
   'Água do dia', 'Beba 2500ml de água hoje.', 'water', 2500, 1, 50, FALSE, TRUE, TRUE, FALSE, 1, 3),
  ('b0000000-0000-0000-0000-000000000002',
   'Treino do dia', 'Complete 90 minutos de atividade física hoje.', 'exercise', 90, 1, 90, FALSE, TRUE, FALSE, FALSE, 1, 3),
  ('b0000000-0000-0000-0000-000000000003',
   'Nutrição do dia', 'Registre as 4 refeições do dia (café, almoço, lanche e jantar).', 'nutrition', 4, 1, 100, FALSE, TRUE, FALSE, FALSE, 1, 3),
  ('b0000000-0000-0000-0000-000000000004',
   'Hidratação em dupla (semana)', 'Juntos, bebam 17.500ml (2500ml/dia cada) em 7 dias.', 'water', 17500, 7, 200, TRUE, TRUE, FALSE, TRUE, 1, 3),
  ('b0000000-0000-0000-0000-000000000005',
   'Reto de 3 dias de treino', 'Complete 270 minutos de atividade física (90min/dia) em 3 dias.', 'exercise', 270, 3, 120, FALSE, TRUE, FALSE, FALSE, 1, 3),
  ('b0000000-0000-0000-0000-000000000006',
   'Semana em movimento', 'Complete 420 minutos de atividade física em 7 dias.', 'exercise', 420, 7, 180, FALSE, TRUE, FALSE, TRUE, 1, 3),
  ('b0000000-0000-0000-0000-000000000007',
   'Água da semana', 'Beba 15.000ml de água em 7 dias.', 'water', 15000, 7, 140, FALSE, TRUE, FALSE, FALSE, 1, 3),
  ('b0000000-0000-0000-0000-000000000008',
   'Nutrição na semana', 'Registre 20 refeições em 7 dias.', 'nutrition', 20, 7, 160, FALSE, TRUE, FALSE, TRUE, 1, 3),
  ('b0000000-0000-0000-0000-000000000009',
   'Treino em dupla (semana)', 'Juntos, completem 700 minutos de atividade física em 7 dias.', 'exercise', 700, 7, 260, TRUE, TRUE, FALSE, TRUE, 1, 3);

-- Vinculações iniciais.
-- Água (sempre ativa) = 'in_progress'. Demais missões começam desativadas
-- ('available'). Temporárias iniciam visíveis com available_until no futuro.

INSERT INTO user_missions (
  user_id, mission_id, current_progress, status, available_until
) VALUES
  -- Émerson
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 0, 'in_progress', NULL),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 0, 'available', NOW() + interval '2 days'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000008', 0, 'available', NOW() + interval '3 days'),
  -- Ana
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 0, 'in_progress', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000005', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 0, 'available', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 0, 'available', NOW() + interval '2 days'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000008', 0, 'available', NOW() + interval '3 days'),
  -- Cooperativas (user_id NULL)
  (NULL, 'b0000000-0000-0000-0000-000000000004', 0, 'available', NOW() + interval '2 days'),
  (NULL, 'b0000000-0000-0000-0000-000000000009', 0, 'available', NOW() + interval '3 days');

-- Loja de recompensas
INSERT INTO rewards (id, title, description, cost_points, created_by) VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'Jantar fora à escolha do outro', 'O(a) parceiro(a) escolhe o restaurante.', 150, NULL),
  ('c0000000-0000-0000-0000-000000000002',
   'Massagem de 30 minutos', 'Sessão de massagem relaxante oferecida pelo(a) parceiro(a).', 120, NULL),
  ('c0000000-0000-0000-0000-000000000003',
   'Sessão Netflix + pizza', 'Escolha o filme/série e a pizza do dia.', 80, NULL),
  ('c0000000-0000-0000-0000-000000000004',
   'Manhã livre sem tarefas', 'Um período da manhã inteira sem afazeres domésticos.', 100, NULL),
  ('c0000000-0000-0000-0000-000000000005',
   'Café da manhã na cama', 'O(a) parceiro(a) prepara seu café favorito e serve na cama.', 40, NULL),
  ('c0000000-0000-0000-0000-000000000006',
   'Escolher o filme da sessão', 'Você escolhe o filme/série sem discussão.', 50, NULL),
  ('c0000000-0000-0000-0000-000000000007',
   'Dia sem cozinhar', 'O(a) parceiro(a) cuida de todas as refeições do dia.', 110, NULL),
  ('c0000000-0000-0000-0000-000000000008',
   'Sobremesa da sua escolha', 'Escolha a sobremesa do dia, sem limites.', 60, NULL),
  ('c0000000-0000-0000-0000-000000000009',
   'Passeio no parque', 'Um passeio ao ar livre juntos, no seu ritmo.', 90, NULL),
  ('c0000000-0000-0000-0000-000000000010',
   'Férias do serviço doméstico', 'O(a) parceiro(a) assume todas as tarefas de casa por um dia.', 200, NULL),
  ('c0000000-0000-0000-0000-000000000011',
   'Rolezinho de bike', 'Um pedal juntos no fim de semana.', 100, NULL),
  ('c0000000-0000-0000-0000-000000000012',
   'Sessão de carinho de 15 min', '15 minutos dedicados só a vocês dois, sem telas.', 70, NULL);

-- =============================================================================
-- Notificações Web Push
-- -----------------------------------------------------------------------------
-- push_subscriptions: assinaturas Push por dispositivo/perfil.
-- reminder_settings: preferências de lembrete por perfil (água, refeições, treino).
-- reminder_sent_logs: rastreio de envios para evitar duplicatas no mesmo dia.
-- =============================================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,            -- { p256dh, auth }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reminder_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT FALSE,
  water_enabled BOOLEAN DEFAULT TRUE,
  water_times TIME[] DEFAULT '{09:00,12:00,15:00,18:00,21:00}',
  meal_enabled BOOLEAN DEFAULT TRUE,
  meal_breakfast TIME DEFAULT '08:00',
  meal_lunch TIME DEFAULT '12:30',
  meal_afternoon TIME DEFAULT '16:00',
  meal_dinner TIME DEFAULT '19:30',
  exercise_enabled BOOLEAN DEFAULT TRUE,
  exercise_time TIME DEFAULT '18:00',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reminder_sent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reminder_key VARCHAR(60) NOT NULL,  -- ex.: 'water:09:00', 'meal:breakfast', 'exercise'
  sent_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, reminder_key, sent_date)
);

CREATE INDEX idx_push_subs_user ON push_subscriptions (user_id);
CREATE INDEX idx_reminder_sent_user_date ON reminder_sent_logs (user_id, sent_date);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_sent_logs ENABLE ROW LEVEL SECURITY;
-- Sem policy anon: gerenciadas exclusivamente no servidor (service role).

-- Seed: preferências padrão para os perfis existentes
INSERT INTO reminder_settings (user_id) VALUES
  ('a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- UPGRADE de banco já existente (criado antes dos campos novos)
-- -----------------------------------------------------------------------------
-- O banco do Supabase que já está em produção NÃO re-roda o CREATE TABLE acima.
-- Para adicionar os campos novos ao banco atual, rode APENAS os comandos abaixo
-- no SQL Editor do Supabase (podem ser re-executados sem problema):
--   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme VARCHAR(30) NOT NULL DEFAULT 'classic-dark';
--   CREATE TYPE meal_slot AS ENUM ('breakfast','lunch','afternoon','dinner');
--   CREATE TABLE exercise_types (...); CREATE TABLE food_items (...);
--   CREATE TABLE meal_logs (...); CREATE TABLE meal_log_items (...);
--   ALTER TABLE logs ADD COLUMN IF NOT EXISTS exercise_type_id UUID REFERENCES exercise_types(id);
--   (e depois CREATE OR REPLACE dos triggers/RPCs + seeds acima)
--
-- CICLO DE MISSÕES (início desativado / água sempre ativa / temporárias):
-- -----------------------------------------------------------------------------
-- Bancos criados ANTES desta versão precisam dos comandos abaixo no SQL Editor
-- do Supabase (podem ser re-executados sem problema, na ordem):
--
--   ALTER TYPE mission_status ADD VALUE IF NOT EXISTS 'available';
--
--   ALTER TABLE missions ADD COLUMN IF NOT EXISTS always_active BOOLEAN DEFAULT FALSE;
--   ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE;
--   ALTER TABLE missions ADD COLUMN IF NOT EXISTS stay_min_days INT DEFAULT 1;
--   ALTER TABLE missions ADD COLUMN IF NOT EXISTS stay_max_days INT DEFAULT 3;
--
--   ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;
--   ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS points_awarded INT DEFAULT 0;
--   ALTER TABLE user_missions ADD COLUMN IF NOT EXISTS next_available_at TIMESTAMPTZ;
--
--   UPDATE missions SET always_active = TRUE WHERE id = 'b0000000-0000-0000-0000-000000000001';
--   UPDATE missions SET is_temporary = TRUE WHERE id IN (
--     'b0000000-0000-0000-0000-000000000004',
--     'b0000000-0000-0000-0000-000000000006',
--     'b0000000-0000-0000-0000-000000000008',
--     'b0000000-0000-0000-0000-000000000009'
--   );
--
--   -- Água volta para 'in_progress'; as demais começam desativadas ('available').
--   UPDATE user_missions um SET status = 'available'
--     FROM missions m
--    WHERE um.mission_id = m.id AND m.always_active = FALSE AND um.status = 'in_progress';
--   UPDATE user_missions um SET status = 'in_progress'
--     FROM missions m
--    WHERE um.mission_id = m.id AND m.always_active = TRUE;
--
--   -- Temporárias que estavam 'available' nascem com prazo de permanência.
--   UPDATE user_missions um SET available_until = NOW() + interval '2 days'
--     FROM missions m
--    WHERE um.mission_id = m.id AND m.is_temporary = TRUE AND um.available_until IS NULL;
--
--   (e depois aplique as CREATE OR REPLACE de handle_log_insert, roll_missions e
--   activate_mission desta versão do schema.sql)
--
-- FUSO HORÁRIO DO "DIA" (correção de registros noturnos / teto diário):
-- -----------------------------------------------------------------------------
-- O "dia" passou a ser calculado no fuso brasileiro (America/Sao_Paulo) e não
-- mais em UTC. Para o banco já existente, rode no SQL Editor (pode repetir):
--
--   CREATE OR REPLACE FUNCTION day_start_br()
--   RETURNS TIMESTAMPTZ
--   LANGUAGE sql
--   STABLE
--   AS $$
--     SELECT (date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
--   $$;
--
--   (e depois re-aplique os CREATE OR REPLACE de handle_log_insert,
--   insert_meal_log, insert_exercise_log e roll_missions desta versão, que
--   trocam date_trunc('day', NOW()) por day_start_br())
--
-- DESFAZER/EXCLUIR REGISTRO:
-- -----------------------------------------------------------------------------
-- Para o banco já existente, rode o CREATE OR REPLACE FUNCTION delete_log(...)
-- desta versão do schema.sql (seção "RPC: desfaz/exclui um registro").
-- =============================================================================