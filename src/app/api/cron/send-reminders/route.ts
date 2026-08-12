import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isMockMode } from "@/lib/supabase/mock";
import { getWebPush } from "@/lib/webpush";
import { DAILY_TARGETS, MEAL_SLOT_LABELS } from "@/lib/gamification";
import type { MealSlot, PushSubscriptionRow, ReminderSettings } from "@/types/database";

export const dynamic = "force-dynamic";

const WINDOW_MINUTES = 10;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const REMINDER_TIME_ZONE = "America/Sao_Paulo";

function nowMinutes(): number {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: REMINDER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function withinWindow(config: string, nowMin: number): boolean {
  return Math.abs(timeToMinutes(config) - nowMin) <= WINDOW_MINUTES;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Web Push não é simulado no mock: dev sem backend apenas salta o envio.
  if (isMockMode()) {
    return NextResponse.json({ ok: true, skipped: "mock" });
  }

  const webpush = getWebPush();
  if (!webpush) {
    return NextResponse.json({ ok: true, skipped: "vapid_not_configured" });
  }

  const nowMin = nowMinutes();
  const today = new Date().toISOString().slice(0, 10);

  const wrap = { sent: 0, skipped: 0, removed: 0, errors: 0 };

  try {
    const { data: settingsList, error: settingsError } = await supabaseAdmin
      .from("reminder_settings")
      .select("*")
      .eq("notifications_enabled", true);

    if (settingsError) {
      // Schema ainda não aplicado no banco: nada a enviar nesta rodada.
      if (/could not find the table/i.test(settingsError.message)) {
        console.warn("cron/send-reminders: tabelas de push ausentes no Supabase (rode o schema.sql)");
        return NextResponse.json({ ok: true, skipped: "schema_missing" });
      }
      console.error("cron/send-reminders: settings error", settingsError);
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }
    const settingsByUser = new Map(
      (settingsList ?? []).map((s) => [s.user_id, s as unknown as ReminderSettings]),
    );
    const userIds = [...settingsByUser.keys()];
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, ...wrap });
    }

    const { data: subs, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subsError) {
      console.error("cron/send-reminders: subscriptions error", subsError);
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    // Evita consultar logs de água além do necessário.
    const waterUsers = new Set(
      [...settingsByUser.entries()]
        .filter(([, s]) => s.water_enabled)
        .map(([id]) => id),
    );
    const waterMet: Record<string, boolean> = {};
    const waterGroup = [...userIds].filter((id) => waterUsers.has(id));

    if (waterGroup.length > 0) {
      const { data: waterLogs, error: waterError } = await supabaseAdmin
        .from("logs")
        .select("user_id, value")
        .eq("type", "water")
        .in("user_id", waterGroup)
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      if (!waterError && waterLogs) {
        const totals = new Map<string, number>();
        for (const log of waterLogs) {
          totals.set(log.user_id, (totals.get(log.user_id) ?? 0) + (log.value ?? 0));
        }
        for (const id of waterGroup) {
          waterMet[id] = (totals.get(id) ?? 0) >= DAILY_TARGETS.water;
        }
      }
    }

    for (const userId of userIds) {
      const settings = settingsByUser.get(userId)!;
      const subsForUser = (subs ?? []).filter((s) => s.user_id === userId);
      if (subsForUser.length === 0) continue;

      const due: { key: string; title: string; body: string; tag: string }[] = [];

      if (settings.water_enabled && !waterMet[userId]) {
        for (const time of settings.water_times ?? []) {
          if (withinWindow(time, nowMin)) {
            due.push({
              key: `water:${time}`,
              title: "💧 Hora de beber água",
              body: "Mantenha o ritmo de hidratação de hoje.",
              tag: "habit-pair-water",
            });
          }
        }
      }

      if (settings.meal_enabled) {
        const slots: [MealSlot, string][] = [
          ["breakfast", settings.meal_breakfast],
          ["lunch", settings.meal_lunch],
          ["afternoon", settings.meal_afternoon],
          ["dinner", settings.meal_dinner],
        ];
        for (const [slot, time] of slots) {
          if (withinWindow(time, nowMin)) {
            due.push({
              key: `meal:${slot}`,
              title: `🍽️ Hora do ${MEAL_SLOT_LABELS[slot].toLowerCase()}`,
              body: "Registre a refeição no app para contabilizar.",
              tag: "habit-pair-meal",
            });
          }
        }
      }

      if (settings.exercise_enabled && withinWindow(settings.exercise_time, nowMin)) {
        due.push({
          key: "exercise",
          title: "🏃 Que tal 30 min de exercício?",
          body: "Registrar o treino rende pontos para o casal.",
          tag: "habit-pair-exercise",
        });
      }

      if (due.length === 0) continue;

      const { data: sentToday, error: sentError } = await supabaseAdmin
        .from("reminder_sent_logs")
        .select("reminder_key")
        .eq("user_id", userId)
        .eq("sent_date", today);

      if (sentError) {
        console.error("cron/send-reminders: sent error", sentError);
        continue;
      }
      const sentKeys = new Set((sentToday ?? []).map((r) => r.reminder_key));

      for (const reminder of due) {
        if (sentKeys.has(reminder.key)) {
          wrap.skipped += 1;
          continue;
        }

        const payload = JSON.stringify({ ...reminder, tag: `${reminder.tag}-${reminder.key}`, url: "/logs" });
        let delivered = false;

        for (const subscription of subsForUser) {
          const pushSub = subscription as unknown as PushSubscriptionRow;
          const target = {
            endpoint: pushSub.endpoint,
            keys: (pushSub.keys as { p256dh: string; auth: string }) ?? {},
          };

          try {
            await webpush.sendNotification(target, payload);
            delivered = true;
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            const message = (err as Error).message ?? "";
            if (status === 404 || status === 410 || /expired|invalid subscription/i.test(message)) {
              // Endpoint morto: remove a assinatura e ganha pontos na próxima rodada.
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .match({ user_id: userId, endpoint: pushSub.endpoint });
              wrap.removed += 1;
            } else {
              console.error("cron/send-reminders: send error", err);
              wrap.errors += 1;
            }
          }
        }

        if (delivered) {
          await supabaseAdmin
            .from("reminder_sent_logs")
            .upsert(
              { user_id: userId, reminder_key: reminder.key, sent_date: today },
              { onConflict: "user_id,reminder_key,sent_date", ignoreDuplicates: true },
            );
          wrap.sent += 1;
        } else {
          wrap.skipped += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, ...wrap });
  } catch (e) {
    console.error("cron/send-reminders", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}