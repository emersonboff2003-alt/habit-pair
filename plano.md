# Plano de melhorias — Habit Pair

Sugestões de evolução do app, ordenadas por impacto na experiência real do casal.
Nada aqui é obrigatório; cada item pode ser feito de forma independente.

---

## Alta prioridade (usabilidade no dia a dia)

### 1. Desfazer / excluir registro
**Problema:** hoje não dá para apagar um toque errado (ex.: registrou 500ml de água sem querer).

**O que envolve:**
- Ação no servidor para remover um log (e devolver os pontos do perfil).
- Atenção ao motor de pontos: hoje os pontos são creditados no `INSERT` (trigger `handle_log_insert`). A remoção precisa reverter `points_earned` no saldo do perfil e o progresso das missões.
- UI: gesto de desfazer após registrar (toast com "Desfazer") e/ou toque longo para excluir no histórico.

**Arquivos prováveis:** `src/lib/actions/logs.ts`, `schema.sql` (nova RPC de delete), `src/components/logs/*`.

### 2. Metas personalizáveis por perfil
**Problema:** metas de água (2500ml) e exercício (90min) são fixas em `src/lib/gamification.ts`.

**O que envolve:**
- Novas colunas em `profiles` (ex.: `water_goal_ml`, `exercise_goal_min`).
- Carregar a meta do perfil ativo em vez de usar as constantes `DAILY_TARGETS`.
- UI simples de configuração (ex.: na tela de início ou numa seção de perfil).

### 3. Sequência (streak)
**Problema:** falta o incentivo clássico de gamificação — quantos dias seguidos o usuário registrou hábito.

**O que envolve:**
- Calcular dias consecutivos com registro (baseado em `logs`).
- Exibir um selo "🔥 N dias seguidos" na home.
- (Opcional) bônus de pontos ao atingir marcos de sequência.

---

## Média prioridade (engajamento)

### 4. Estatísticas do casal
**O que envolve:**
- Além do calendário de histórico (aba "Histórico"), gráficos simples:
  - Tendência semanal de água/exercício.
  - Total de pontos por semana.
- Ranking já mostra "hoje"; adicionar opções "semana" e "mês".

### 5. Editar missões e recompensas pela interface
**Problema:** hoje missões e recompensas só são alteradas via SQL no Supabase.

**O que envolve:**
- Tela de administração para criar/editar recompensas (título, custo) e missões (título, meta, recompensa, duração).
- Novas ações no servidor (`src/lib/actions/rewards.ts`, `src/lib/actions/missions.ts`).

### 6. Confirmação em registros rápidos
**Problema:** toque acidental no botão de água/treino rápido.

**O que envolve:**
- Confirmação opcional (ou "desfazer" imediato, item 1) para evitar registros acidentais.
- Preferência por perfil.

---

## Baixa prioridade (expansão)

### 7. Criar perfil dinamicamente
**Problema:** o app é fixo em 2 perfis (Émerson e Ana).

**O que envolve:**
- Fluxo de "adicionar perfil" (nome, tema).
- Generalizar telas que assumem 2 perfis (leaderboard, missões cooperativas).

### 8. Backup / exportar dados
**O que envolve:**
- Exportar histórico em CSV (água, exercício, refeições).

### 9. Onboarding
**O que envolve:**
- Tela de boas-vindas explicando pontos, missões e recompensas para quem abre o app pela primeira vez.

---

## Ordem recomendada

1. Desfazer/excluir registro (item 1)
2. Sequência — streak (item 3)
3. Metas personalizáveis (item 2)
4. Estatísticas do casal (item 4)

---

## Estado atual (resumo)

- **Stack:** Next.js 16 (App Router) + Supabase (Postgres) + Web Push, PWA, deploy no Vercel.
- **Já feito:** separação de dados por perfil, correção de fuso (Brasília), aba de histórico com calendário, notificações com horários de água dinâmicos e seções colapsáveis.
- **Pontos/missões:** motor de gamificação no banco (trigger + RPCs em `schema.sql`).
