"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, BellOff, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  updateReminderSettingsAction,
} from "@/lib/actions/push";
import {
  getDeviceSubscription,
  pushSubscriptionToKeys,
  subscribeDevice,
  unsubscribeDevice,
} from "@/lib/push";
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from "@/lib/gamification";
import type { MealSlot, ReminderSettings, ReminderSettingsInput } from "@/types/database";
import { cn } from "@/lib/utils";

interface NotificationSettingsProps {
  settings: ReminderSettings | null;
}

type Busy = "subscribe" | "disable" | "save" | null;
type Message = { kind: "success" | "error"; text: string } | null;

const DEFAULT_WATER_TIMES = ["09:00", "12:00", "15:00", "18:00", "21:00"];

const MEAL_TIME_FIELDS: Record<MealSlot, keyof ReminderSettingsInput> = {
  breakfast: "meal_breakfast",
  lunch: "meal_lunch",
  afternoon: "meal_afternoon",
  dinner: "meal_dinner",
};

function defaultsFromSettings(settings: ReminderSettings | null): ReminderSettingsInput {
  return {
    notifications_enabled: settings?.notifications_enabled ?? false,
    water_enabled: settings?.water_enabled ?? true,
    water_times:
      settings?.water_times && settings.water_times.length > 0
        ? settings.water_times
        : DEFAULT_WATER_TIMES,
    meal_enabled: settings?.meal_enabled ?? true,
    meal_breakfast: settings?.meal_breakfast ?? "08:00",
    meal_lunch: settings?.meal_lunch ?? "12:30",
    meal_afternoon: settings?.meal_afternoon ?? "16:00",
    meal_dinner: settings?.meal_dinner ?? "19:30",
    exercise_enabled: settings?.exercise_enabled ?? true,
    exercise_time: settings?.exercise_time ?? "18:00",
  };
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-raised disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block truncate text-[11px] text-muted">{description}</span>}
      </span>
      <span
        className={cn(
          "flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors",
          checked ? "justify-end bg-emerald-500/70" : "justify-start bg-raised",
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full shadow transition-colors",
            checked ? "bg-zinc-950" : "bg-muted",
          )}
        />
      </span>
    </button>
  );
}

export function NotificationSettings({ settings }: NotificationSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReminderSettingsInput>(() => defaultsFromSettings(settings));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<Message>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    getDeviceSubscription().then((sub) => {
      if (active) setSubscribed(Boolean(sub));
    });
    return () => {
      active = false;
    };
  }, [open]);

  function handleOpenChange(next: boolean) {
    setBusy(null);
    if (next) {
      setDraft(defaultsFromSettings(settings));
      setMessage(null);
    }
    setOpen(next);
  }

  function notify(msg: Message) {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 4000);
  }

  async function handleToggleEnabled(next: boolean) {
    setBusy(next ? "subscribe" : "disable");
    setMessage(null);

    if (next) {
      const existing = await getDeviceSubscription();
      const subscription = existing ?? (await subscribeDevice());
      if (!subscription) {
        setBusy(null);
        notify({
          kind: "error",
          text: "Sem permissão para notificações. No iPhone/iPad, instale o app na tela de início e tente novamente.",
        });
        return;
      }
      const keys = pushSubscriptionToKeys(subscription);
      const saved = await savePushSubscriptionAction(keys.endpoint, {
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      if (!saved.ok) {
        setBusy(null);
        notify({ kind: "error", text: saved.error ?? "Não foi possível ativar." });
        return;
      }
      setSubscribed(true);
    } else {
      await unsubscribeDevice();
      await removePushSubscriptionAction();
      setSubscribed(false);
    }

    const nextDraft = { ...draft, notifications_enabled: next };
    setDraft(nextDraft);
    const res = await updateReminderSettingsAction(nextDraft);
    setBusy(null);
    notify(
      res.ok
        ? { kind: "success", text: next ? "Lembretes ativados" : "Lembretes desativados" }
        : { kind: "error", text: res.error ?? "Não foi possível salvar." },
    );
  }

  function setWaterTime(index: number, value: string) {
    setDraft((d) => {
      const times = [...d.water_times];
      times[index] = value;
      return { ...d, water_times: times };
    });
  }

  async function handleSave() {
    setBusy("save");
    setMessage(null);
    const res = await updateReminderSettingsAction(draft);
    setBusy(null);
    notify(
      res.ok
        ? { kind: "success", text: "Preferências salvas" }
        : { kind: "error", text: res.error ?? "Não foi possível salvar." },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-card-hover",
            draft.notifications_enabled ? "text-emerald-400" : "text-fg-2",
          )}
          aria-label="Lembretes e notificações"
          title="Lembretes e notificações"
        >
          {draft.notifications_enabled ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lembretes e notificações</DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
            draft.notifications_enabled
              ? subscribed
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-border bg-card text-muted",
          )}
        >
          {draft.notifications_enabled ? (
            subscribed ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <Info className="h-5 w-5 shrink-0" />
            )
          ) : (
            <BellRing className="h-5 w-5 shrink-0" />
          )}
          <span className="flex-1">
            {draft.notifications_enabled
              ? subscribed
                ? "Lembretes ativos neste dispositivo"
                : "Lembretes ativos, mas sem assinatura neste dispositivo"
              : "Lembretes desativados"}
          </span>
        </div>

        <Toggle
          label="Receber lembretes"
          description="Água, refeições e exercício em horários definidos"
          checked={draft.notifications_enabled}
          disabled={busy !== null}
          onChange={handleToggleEnabled}
        />

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Água</p>
          <Toggle
            label="Lembretes de água"
            checked={draft.water_enabled}
            disabled={busy !== null}
            onChange={(next) => setDraft((d) => ({ ...d, water_enabled: next }))}
          />
          <div className="grid grid-cols-3 gap-2">
            {draft.water_times.map((time, index) => (
              <input
                key={index}
                type="time"
                value={time}
                disabled={busy !== null}
                onChange={(e) => setWaterTime(index, e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-card px-2 text-sm outline-none placeholder:text-muted disabled:opacity-50"
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Refeições</p>
          <Toggle
            label="Lembretes de refeições"
            checked={draft.meal_enabled}
            disabled={busy !== null}
            onChange={(next) => setDraft((d) => ({ ...d, meal_enabled: next }))}
          />
          <div className="space-y-2">
            {MEAL_SLOTS.map((slot) => {
              const field = MEAL_TIME_FIELDS[slot];
              return (
                <label key={slot} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-fg-2">{MEAL_SLOT_LABELS[slot]}</span>
                  <input
                    type="time"
                    value={draft[field] as string}
                    disabled={busy !== null}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [field]: e.target.value }) as ReminderSettingsInput)
                    }
                    className="h-9 rounded-xl border border-border bg-card px-2 text-sm outline-none disabled:opacity-50"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Exercício</p>
          <Toggle
            label="Lembrete de exercício"
            checked={draft.exercise_enabled}
            disabled={busy !== null}
            onChange={(next) => setDraft((d) => ({ ...d, exercise_enabled: next }))}
          />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-fg-2">Horário</span>
            <input
              type="time"
              value={draft.exercise_time}
              disabled={busy !== null}
              onChange={(e) => setDraft((d) => ({ ...d, exercise_time: e.target.value }))}
              className="h-9 rounded-xl border border-border bg-card px-2 text-sm outline-none disabled:opacity-50"
            />
          </label>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          No iPhone/iPad é preciso instalar o app (Adicionar à Tela de Início) para receber as
          notificações.
        </p>

        {message && (
          <p
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              message.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-red-900 bg-red-950/40 text-red-300",
            )}
          >
            {message.text}
          </p>
        )}

        <Button type="button" onClick={handleSave} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar configurações
        </Button>
      </DialogContent>
    </Dialog>
  );
}