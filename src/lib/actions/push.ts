"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionProfileId } from "@/lib/session";
import type { Json, ReminderSettingsInput } from "@/types/database";

type ActionResult = { ok: boolean; error?: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MEAL_FIELDS = [
  "meal_breakfast",
  "meal_lunch",
  "meal_afternoon",
  "meal_dinner",
] as const;

function validateTimes(times: string[]): boolean {
  return times.every((t) => TIME_PATTERN.test(t));
}

/** Persiste a assinatura push do dispositivo (upsert por endpoint). */
export async function savePushSubscriptionAction(
  endpoint: string,
  keys: { p256dh: string; auth: string },
): Promise<ActionResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    if (!endpoint || !/^https?:\/\//.test(endpoint)) {
      return { ok: false, error: "Assinatura inválida." };
    }
    if (!keys.p256dh || !keys.auth) {
      return { ok: false, error: "Chaves da assinatura inválidas." };
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: profileId,
          endpoint,
          keys: keys as unknown as Json,
        },
        { onConflict: "endpoint" },
      );

    if (error) {
      console.error("savePushSubscriptionAction: upsert error", error);
      return { ok: false, error: "Não foi possível salvar a assinatura." };
    }

    return { ok: true };
  } catch (e) {
    console.error("savePushSubscriptionAction", e);
    return { ok: false, error: "Erro inesperado ao salvar a assinatura." };
  }
}

/** Remove as assinaturas push do perfil ativo. */
export async function removePushSubscriptionAction(): Promise<ActionResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", profileId);

    return { ok: true };
  } catch (e) {
    console.error("removePushSubscriptionAction", e);
    return { ok: false, error: "Não foi possível remover a assinatura." };
  }
}

/** Persiste as preferências de lembrete do perfil (upsert por user_id). */
export async function updateReminderSettingsAction(
  settings: ReminderSettingsInput,
): Promise<ActionResult> {
  try {
    const profileId = await getSessionProfileId();
    if (!profileId) return { ok: false, error: "Sessão expirada. Selecione o perfil novamente." };

    if (!Array.isArray(settings.water_times) || !validateTimes(settings.water_times)) {
      return { ok: false, error: "Horários de água inválidos." };
    }
    for (const field of MEAL_FIELDS) {
      if (!TIME_PATTERN.test(settings[field])) {
        return { ok: false, error: "Horário de refeição inválido." };
      }
    }
    if (!TIME_PATTERN.test(settings.exercise_time)) {
      return { ok: false, error: "Horário de exercício inválido." };
    }

    const { error } = await supabaseAdmin
      .from("reminder_settings")
      .upsert(
        {
          ...settings,
          user_id: profileId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("updateReminderSettingsAction: upsert error", error);
      return { ok: false, error: "Não foi possível salvar as preferências." };
    }

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("updateReminderSettingsAction", e);
    return { ok: false, error: "Erro inesperado ao salvar as preferências." };
  }
}