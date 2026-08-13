"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  BellOff,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Plus,
  X,
} from "lucide-react";
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
type SectionKey = "water" | "meals" | "exercise";

const DEFAULT_WATER_TIMES = ["09:00", "12:00", "15:00", "18:00", "21:00"];
const MAX_WATER_TIMES = 12;
const MIN_WATER_TIMES = 1;

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
      <Switch checked={checked} />
    </button>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
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
  );
}

function Section({
  title,
  summary,
  enabled,
  expanded,
  disabled,
  onToggle,
  onToggleExpand,
  children,
}: {
  title: string;
  summary: string;
  enabled: boolean;
  expanded: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
  onToggleExpand: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="text-sm font-semibold">{title}</span>
          <span className="truncate text-xs text-muted">{summary}</span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${title} ${enabled ? "ligado" : "desligado"}`}
          disabled={disabled}
          onClick={() => onToggle(!enabled)}
          className="disabled:opacity-50"
        >
          <Switch checked={enabled} />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised"
          aria-label={expanded ? `Recolher ${title}` : `Expandir ${title}`}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}

export function NotificationSettings({ settings }: NotificationSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReminderSettingsInput>(() => defaultsFromSettings(settings));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<Message>(null);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    water: false,
    meals: false,
    exercise: false,
  });
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

  const disabled = busy !== null;

  const sortedWaterTimes = useMemo(() => [...draft.water_times].sort(), [draft.water_times]);
  const waterSummary = sortedWaterTimes.join(" · ");
  const mealsSummary = MEAL_SLOTS.map((slot) => draft[MEAL_TIME_FIELDS[slot]] as string).join(" · ");

  function handleOpenChange(next: boolean) {
    setBusy(null);
    if (next) {
      setDraft(defaultsFromSettings(settings));
      setMessage(null);
      setExpanded({ water: false, meals: false, exercise: false });
    }
    setOpen(next);
  }

  function toggleExpand(key: SectionKey) {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
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

    const nextDraft = {
      ...draft,
      notifications_enabled: next,
      water_times: [...draft.water_times].sort(),
    };
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

  function addWaterTime() {
    setDraft((d) => {
      if (d.water_times.length >= MAX_WATER_TIMES) return d;
      const last = d.water_times[d.water_times.length - 1] ?? "08:00";
      const [h, m] = last.split(":").map(Number);
      const nextHour = ((h ?? 8) + 1) % 24;
      const next = `${String(nextHour).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
      return { ...d, water_times: [...d.water_times, next] };
    });
  }

  function removeWaterTime(index: number) {
    setDraft((d) => {
      if (d.water_times.length <= MIN_WATER_TIMES) return d;
      const times = [...d.water_times];
      times.splice(index, 1);
      return { ...d, water_times: times };
    });
  }

  async function handleSave() {
    setBusy("save");
    setMessage(null);
    const res = await updateReminderSettingsAction({
      ...draft,
      water_times: [...draft.water_times].sort(),
    });
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
          disabled={disabled}
          onChange={handleToggleEnabled}
        />

        <div className="space-y-2">
          <Section
            title="Água"
            summary={waterSummary}
            enabled={draft.water_enabled}
            expanded={expanded.water}
            disabled={disabled}
            onToggle={(next) => setDraft((d) => ({ ...d, water_enabled: next }))}
            onToggleExpand={() => toggleExpand("water")}
          >
            <div className="space-y-2">
              {draft.water_times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={time}
                    disabled={disabled}
                    onChange={(e) => setWaterTime(index, e.target.value)}
                    className="h-9 w-full rounded-xl border border-border bg-card px-2 text-sm outline-none placeholder:text-muted disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => removeWaterTime(index)}
                    disabled={disabled || draft.water_times.length <= MIN_WATER_TIMES}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:text-red-400 disabled:opacity-40"
                    aria-label="Remover horário"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addWaterTime}
                disabled={disabled || draft.water_times.length >= MAX_WATER_TIMES}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm text-muted transition-colors hover:bg-raised disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Adicionar horário
              </button>
            </div>
          </Section>

          <Section
            title="Refeições"
            summary={mealsSummary}
            enabled={draft.meal_enabled}
            expanded={expanded.meals}
            disabled={disabled}
            onToggle={(next) => setDraft((d) => ({ ...d, meal_enabled: next }))}
            onToggleExpand={() => toggleExpand("meals")}
          >
            <div className="space-y-2">
              {MEAL_SLOTS.map((slot) => {
                const field = MEAL_TIME_FIELDS[slot];
                return (
                  <label key={slot} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-fg-2">{MEAL_SLOT_LABELS[slot]}</span>
                    <input
                      type="time"
                      value={draft[field] as string}
                      disabled={disabled}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [field]: e.target.value }) as ReminderSettingsInput)
                      }
                      className="h-9 rounded-xl border border-border bg-card px-2 text-sm outline-none disabled:opacity-50"
                    />
                  </label>
                );
              })}
            </div>
          </Section>

          <Section
            title="Exercício"
            summary={draft.exercise_time}
            enabled={draft.exercise_enabled}
            expanded={expanded.exercise}
            disabled={disabled}
            onToggle={(next) => setDraft((d) => ({ ...d, exercise_enabled: next }))}
            onToggleExpand={() => toggleExpand("exercise")}
          >
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg-2">Horário</span>
              <input
                type="time"
                value={draft.exercise_time}
                disabled={disabled}
                onChange={(e) => setDraft((d) => ({ ...d, exercise_time: e.target.value }))}
                className="h-9 rounded-xl border border-border bg-card px-2 text-sm outline-none disabled:opacity-50"
              />
            </label>
          </Section>
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

        <Button type="button" onClick={handleSave} disabled={disabled}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar configurações
        </Button>
      </DialogContent>
    </Dialog>
  );
}
