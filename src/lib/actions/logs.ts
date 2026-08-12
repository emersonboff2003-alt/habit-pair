"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";
import { validateLogValue } from "@/lib/gamification";
import type {
  AddLogInput,
  AddLogResult,
  InsertExerciseLogRpcResult,
  InsertMealLogRpcResult,
  Json,
  Log,
  LogType,
  MealItemInput,
  MealSlot,
  UserMissionWithMission,
} from "@/types/database";

const NUTRITION_CATEGORIES = ["macros", "sweets", "meals"];
const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "afternoon", "dinner"];

/**
 * Consulta as missões concluídas recentemente (por esta inserção) e retorna
 * os títulos para exibição no feedback do usuário.
 */
async function detectCompletedMissionTitles(
  profileId: string,
): Promise<string[] | undefined> {
  const before = new Date(Date.now() - 15000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("user_missions")
    .select("*, missions(title)")
    .eq("status", "completed")
    .or(`user_id.eq.${profileId},user_id.is.null`)
    .gte("completed_at", before);

  if (error || !data) return undefined;
  const titles = (data as unknown as UserMissionWithMission[])
    .map((um) => um.mission?.title)
    .filter((t): t is string => Boolean(t));
  return titles.length > 0 ? titles : undefined;
}

/**
 * Registra um novo log. O trigger `handle_log_insert` calcula os pontos
 * (respeitando tetos diários), aplica regras de nutrição e atualiza o
 * progresso das missões, creditando pontos ao completá-las.
 */
export async function addLogAction(input: AddLogInput): Promise<AddLogResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente.", pointsEarned: 0 };

    const { type, value, description } = input;

    if (!["water", "exercise", "nutrition"].includes(type as string)) {
      return { ok: false, error: "Tipo de registro inválido.", pointsEarned: 0 };
    }

    const validationError = validateLogValue(type as LogType, value);
    if (validationError) {
      return { ok: false, error: validationError, pointsEarned: 0 };
    }

    if (type === "nutrition") {
      if (!description || !NUTRITION_CATEGORIES.includes(description)) {
        return { ok: false, error: "Categoria nutricional inválida.", pointsEarned: 0 };
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("logs")
      .insert({
        user_id: profileId,
        type: type as LogType,
        value,
        description: type === "nutrition" ? description : null,
      })
      .select("*")
      .single<Log>();

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("nutricao_duplicada") || message.includes("já registrado")) {
        return { ok: false, error: "Este check-in nutricional já foi feito hoje.", pointsEarned: 0 };
      }
      console.error("addLogAction: insert error", error);
      return { ok: false, error: "Não foi possível salvar o registro.", pointsEarned: 0 };
    }

    const completedMissionTitles = await detectCompletedMissionTitles(profileId);

    revalidatePath("/");
    revalidatePath("/logs");
    revalidatePath("/missions");

    return { ok: true, pointsEarned: inserted.points_earned, completedMissionTitles };
  } catch (e) {
    console.error("addLogAction", e);
    return { ok: false, error: "Erro inesperado ao salvar o registro.", pointsEarned: 0 };
  }
}

/**
 * Registra uma refeição rápida (padrão, com pontos fixos) para um horário.
 */
export async function addQuickMealAction(slot: MealSlot): Promise<AddLogResult> {
  return addMealAction(slot, true, []);
}

/**
 * Registra uma refeição detalhada com uma lista de itens (catálogo ou livre).
 */
export async function addDetailedMealAction(
  slot: MealSlot,
  items: MealItemInput[],
): Promise<AddLogResult> {
  return addMealAction(slot, false, items);
}

async function addMealAction(
  slot: MealSlot,
  isQuick: boolean,
  items: MealItemInput[],
): Promise<AddLogResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente.", pointsEarned: 0 };

    if (!MEAL_SLOTS.includes(slot)) {
      return { ok: false, error: "Horário de refeição inválido.", pointsEarned: 0 };
    }

    if (!isQuick) {
      if (items.length === 0) {
        return { ok: false, error: "Adicione ao menos um item à refeição.", pointsEarned: 0 };
      }
      if (items.length > 12) {
        return { ok: false, error: "Máximo de 12 itens por refeição.", pointsEarned: 0 };
      }
      const validated = items.map((item) => {
        const portion = Math.max(1, Math.floor(item.portion ?? 1));
        return {
          foodItemId: item.foodItemId ?? undefined,
          customName: item.customName?.trim() || undefined,
          portion,
        };
      });
      const hasInvalid = validated.some((i) => !i.foodItemId && !i.customName);
      if (hasInvalid) {
        return { ok: false, error: "Cada item precisa ser do catálogo ou ter um nome.", pointsEarned: 0 };
      }
    }

    const { data, error } = await supabaseAdmin.rpc("insert_meal_log", {
      p_user_id: profileId,
      p_slot: slot,
      p_is_quick: isQuick,
      p_items: items as unknown as Json,
    });

    if (error) {
      console.error("addMealAction: rpc error", error);
      return { ok: false, error: "Não foi possível salvar a refeição.", pointsEarned: 0 };
    }

    const result = data as unknown as InsertMealLogRpcResult;
    if (!result.ok) {
      const message =
        result.error === "refeicao_rapida_duplicada"
          ? "Você já registrou uma refeição rápida neste horário hoje."
          : result.error === "sem_itens"
            ? "Adicione ao menos um item à refeição."
            : result.error === "item_invalido"
              ? "Um dos itens da refeição é inválido."
              : "Não foi possível salvar a refeição.";
      return { ok: false, error: message, pointsEarned: 0 };
    }

    const completedMissionTitles = await detectCompletedMissionTitles(profileId);

    revalidatePath("/");
    revalidatePath("/logs");
    revalidatePath("/missions");

    return { ok: true, pointsEarned: result.points_earned ?? 0, completedMissionTitles };
  } catch (e) {
    console.error("addMealAction", e);
    return { ok: false, error: "Erro inesperado ao salvar a refeição.", pointsEarned: 0 };
  }
}

/**
 * Registra um treino rápido (genérico, pontos fixos).
 */
export async function addQuickExerciseAction(): Promise<AddLogResult> {
  return addExerciseAction(null, null);
}

/**
 * Registra um treino detalhado com modalidade, duração e distância opcional.
 */
export async function addDetailedExerciseAction(
  exerciseTypeId: string,
  minutes: number,
  distance?: string,
): Promise<AddLogResult> {
  return addExerciseAction(exerciseTypeId, minutes, distance);
}

async function addExerciseAction(
  exerciseTypeId: string | null,
  minutes: number | null,
  distance?: string,
): Promise<AddLogResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente.", pointsEarned: 0 };

    if (exerciseTypeId) {
      if (!Number.isInteger(minutes) || !minutes || minutes <= 0 || minutes > 600) {
        return { ok: false, error: "Informe uma duração válida (1–600 minutos).", pointsEarned: 0 };
      }
      const trimmedDistance = distance?.trim();
      if (trimmedDistance && trimmedDistance.length > 60) {
        return { ok: false, error: "Descrição de distância muito longa.", pointsEarned: 0 };
      }
    }

    const { data, error } = await supabaseAdmin.rpc("insert_exercise_log", {
      p_user_id: profileId,
      p_exercise_type_id: exerciseTypeId,
      p_minutes: minutes,
      p_distance: distance?.trim() || null,
    });

    if (error) {
      console.error("addExerciseAction: rpc error", error);
      return { ok: false, error: "Não foi possível salvar o treino.", pointsEarned: 0 };
    }

    const result = data as unknown as InsertExerciseLogRpcResult;
    if (!result.ok) {
      const message =
        result.error === "treino_rapido_duplicado"
          ? "Você já registrou um treino rápido hoje."
          : result.error === "tipo_exercicio_invalido"
            ? "Modalidade de exercício inválida."
            : result.error === "minutos_invalidos"
              ? "Duração de treino inválida."
              : "Não foi possível salvar o treino.";
      return { ok: false, error: message, pointsEarned: 0 };
    }

    const completedMissionTitles = await detectCompletedMissionTitles(profileId);

    revalidatePath("/");
    revalidatePath("/logs");
    revalidatePath("/missions");

    return { ok: true, pointsEarned: result.points_earned ?? 0, completedMissionTitles };
  } catch (e) {
    console.error("addExerciseAction", e);
    return { ok: false, error: "Erro inesperado ao salvar o treino.", pointsEarned: 0 };
  }
}
