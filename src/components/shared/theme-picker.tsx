"use client";

import { useState, useTransition, useEffect } from "react";
import { Palette, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateThemeAction } from "@/lib/actions/theme";
import { THEME_COLORS, THEME_MODES, CLASSIC_THEME } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface ThemePickerProps {
  current: string;
}

/**
 * Seletor de tema do perfil ativo. Cada perfil tem a sua escolha salva no
 * banco (profiles.theme). Os swatches usam as próprias variáveis do tema como
 * pré-visualização (via data-theme no elemento).
 */
export function ThemePicker({ current }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(current);

  // Se o perfil ativo mudar (ex.: troca de perfil sem recarregar), reflete a
  // escolha salva do novo perfil no seletor.
  useEffect(() => {
    setActive(current);
  }, [current]);

  function apply(theme: string) {
    const previous = active;
    setActive(theme);
    document.documentElement.setAttribute("data-theme", theme);

    startTransition(async () => {
      const result = await updateThemeAction(theme);
      if (!result.ok) {
        setActive(previous);
        document.documentElement.setAttribute("data-theme", previous);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-fg-2 transition-colors hover:bg-card-hover"
        aria-label="Alterar tema"
        title="Alterar tema"
      >
        <Palette className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tema do app</DialogTitle>
            <DialogDescription>
              Escolha a cor e o estilo. Vale só para o seu perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Clássico
              </p>
              <button
                type="button"
                data-theme={CLASSIC_THEME}
                onClick={() => apply(CLASSIC_THEME)}
                disabled={pending}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg)] p-2 text-left transition-all",
                  active === CLASSIC_THEME
                    ? "ring-2 ring-accent"
                    : "hover:scale-[1.02] hover:opacity-90",
                  pending && "opacity-60",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--hp-accent)] text-zinc-950">
                  {active === CLASSIC_THEME ? <Check className="h-4 w-4" /> : null}
                </span>
                <span className="text-xs font-medium text-[var(--hp-fg)]">
                  Original (escuro)
                </span>
              </button>
            </div>

            {THEME_COLORS.map((color) => (
              <div key={color.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {color.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_MODES.map((mode) => {
                    const theme = `${color.id}-${mode.id}`;
                    const isActive = active === theme;
                    return (
                      <button
                        key={theme}
                        type="button"
                        data-theme={theme}
                        onClick={() => apply(theme)}
                        disabled={pending}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border border-[var(--hp-border)] bg-[var(--hp-bg)] p-2 text-left transition-all",
                          isActive
                            ? "ring-2 ring-accent"
                            : "hover:scale-[1.02] hover:opacity-90",
                          pending && "opacity-60",
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--hp-accent)] text-zinc-950">
                          {isActive ? <Check className="h-4 w-4" /> : null}
                        </span>
                        <span className="text-xs font-medium text-[var(--hp-fg)]">
                          {mode.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {pending && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
