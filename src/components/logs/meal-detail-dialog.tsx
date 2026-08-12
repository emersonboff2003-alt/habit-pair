"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addDetailedMealAction } from "@/lib/actions/logs";
import {
  calcDetailedMealPoints,
  COMPLETE_MEAL_BONUS,
  COMPLETE_MEAL_MIN_ITEMS,
  CUSTOM_ITEM_POINTS,
  FOOD_CATEGORY_LABELS,
  MEAL_SLOT_LABELS,
} from "@/lib/gamification";
import type { AddLogResult, FoodItem, MealSlot } from "@/types/database";
import { cn } from "@/lib/utils";

interface MealDetailDialogProps {
  slot: MealSlot;
  foodItems: FoodItem[];
  onResult?: (result: AddLogResult) => void;
}

interface SelectedItem {
  key: number;
  foodItemId?: string;
  customName: string;
  portion: number;
}

const CATEGORIES = Object.keys(FOOD_CATEGORY_LABELS);

export function MealDetailDialog({ slot, foodItems, onResult }: MealDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foodItems.filter((food) => {
      if (category !== "all" && food.category !== category) return false;
      if (q && !food.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [foodItems, query, category]);

  const preview = useMemo(
    () =>
      calcDetailedMealPoints(
        selected.map((s) => ({
          foodItemId: s.foodItemId,
          customName: s.customName,
          portion: s.portion,
        })),
        foodItems,
      ),
    [selected, foodItems],
  );

  const canSave = selected.length > 0 && !pending;

  function addFood(food: FoodItem) {
    setError(null);
    setSelected((prev) => [
      ...prev,
      { key: Date.now() + Math.random(), foodItemId: food.id, customName: "", portion: 1 },
    ]);
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    setError(null);
    setSelected((prev) => [
      ...prev,
      { key: Date.now() + Math.random(), foodItemId: undefined, customName: name, portion: 1 },
    ]);
    setCustomName("");
  }

  function removeItem(key: number) {
    setSelected((prev) => prev.filter((s) => s.key !== key));
  }

  function setPortion(key: number, portion: number) {
    setSelected((prev) =>
      prev.map((s) => (s.key === key ? { ...s, portion: Math.max(1, portion) } : s)),
    );
  }

  function reset() {
    setSelected([]);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await addDetailedMealAction(
        slot,
        selected.map((s) => ({
          foodItemId: s.foodItemId,
          customName: s.customName || undefined,
          portion: s.portion,
        })),
      );
      if (result.ok) {
        reset();
        setOpen(false);
        onResult?.(result);
      } else {
        setError(result.error ?? "Não foi possível salvar a refeição.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="nutrition" size="sm" onClick={() => reset()}>
          Detalhar refeição
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhar {MEAL_SLOT_LABELS[slot]}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "rounded-xl border px-2 py-1.5 text-xs font-medium transition-colors",
              category === "all"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-border text-muted hover:bg-raised",
            )}
          >
            Todas
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-xl border px-2 py-1.5 text-xs font-medium transition-colors",
                category === cat
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-border text-muted hover:bg-raised",
              )}
            >
              {FOOD_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar alimento..."
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>

        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nenhum alimento encontrado.</p>
          ) : (
            filtered.map((food) => {
              const already = selected.find((s) => s.foodItemId === food.id);
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => addFood(food)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{food.name}</span>
                    <span className="block text-xs text-muted">
                      {FOOD_CATEGORY_LABELS[food.category]} · +{food.points} pts
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      already
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-emerald-500/10 text-emerald-300",
                    )}
                  >
                    {already ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Adicionar item livre (ex.: prato feito em casa)"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!customName.trim()}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {selected.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Itens selecionados</p>
            {selected.map((item) => {
              const food = item.foodItemId
                ? foodItems.find((f) => f.id === item.foodItemId)
                : undefined;
              const name = food?.name ?? item.customName ?? "Item livre";
              const unitPoints = food?.points ?? CUSTOM_ITEM_POINTS;
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPortion(item.key, item.portion - 1)}
                      aria-label="Diminuir porção"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-raised text-muted hover:text-foreground"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-14 text-center text-sm font-semibold">
                      1x{item.portion} pts · {unitPoints * item.portion}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPortion(item.key, item.portion + 1)}
                      aria-label="Aumentar porção"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-raised text-muted hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label="Remover item"
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm">
          {selected.length > 0 ? (
            <p className="flex justify-between font-semibold">
              <span>{preview.itemCount} item(ns)</span>
              <span className="text-emerald-300">+{preview.points} pts</span>
            </p>
          ) : (
            <p className="text-muted">Selecione os alimentos para ver os pontos.</p>
          )}
          {selected.length > 0 && preview.itemCount < COMPLETE_MEAL_MIN_ITEMS && (
            <p className="mt-1 text-xs text-muted">
              +{COMPLETE_MEAL_BONUS} pts de bônus ao alcançar {COMPLETE_MEAL_MIN_ITEMS} itens.
            </p>
          )}
          {preview.bonusApplied && (
            <p className="mt-1 text-xs font-medium text-emerald-300">
              Bônus de refeição completa aplicado (+{COMPLETE_MEAL_BONUS} pts).
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button type="button" onClick={handleSave} disabled={!canSave}>
          Registrar refeição
        </Button>
      </DialogContent>
    </Dialog>
  );
}