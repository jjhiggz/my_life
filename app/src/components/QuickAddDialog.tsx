import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { invoke } from "~/lib/telemetry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

type Serving = {
  id: string;
  label: string;
  calories?: number;
  protein_g?: number;
};

type Food = {
  id: string;
  display_name: string;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

function currentMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h <= 10) return "breakfast";
  if (h >= 11 && h <= 14) return "lunch";
  if (h >= 17 && h <= 20) return "dinner";
  return "snack";
}

export default function QuickAddDialog(props: {
  food: Food | null;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [servings] = createResource(
    () => props.food?.id,
    async (id) => {
      if (!id) return [];
      return invoke<Serving[]>("list_food_servings", { foodId: id });
    },
  );

  const [selectedServingId, setSelectedServingId] = createSignal<string>("");
  const [quantity, setQuantity] = createSignal<number>(1);
  const [mealType, setMealType] = createSignal<MealType>(currentMealType());
  const [busy, setBusy] = createSignal(false);

  // Auto-select first serving when servings load
  createEffect(() => {
    const list = servings();
    if (list && list.length > 0 && !selectedServingId()) {
      setSelectedServingId(list[0].id);
    }
  });

  // Reset when dialog reopens
  createEffect(() => {
    if (props.food) {
      setMealType(currentMealType());
      setQuantity(1);
      setSelectedServingId("");
    }
  });

  const selectedServing = () =>
    (servings() ?? []).find((s) => s.id === selectedServingId());

  const previewCal = () => {
    const s = selectedServing();
    if (!s?.calories) return 0;
    return Math.round(s.calories * quantity());
  };

  const previewProtein = () => {
    const s = selectedServing();
    if (!s?.protein_g) return 0;
    return Math.round(s.protein_g * quantity() * 10) / 10;
  };

  const handleConfirm = async () => {
    if (!props.food || !selectedServingId() || busy()) return;
    setBusy(true);
    try {
      await invoke("log_quick_add", {
        foodId: props.food.id,
        servingId: selectedServingId(),
        quantity: quantity(),
        mealType: mealType(),
      });
      props.onLogged();
      props.onClose();
    } catch (e) {
      console.error("log_quick_add failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!props.food}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.food?.display_name ?? ""}</DialogTitle>
          <DialogDescription>Log this food to today.</DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-2">
          {/* Meal type */}
          <div class="grid gap-2">
            <Label>Meal</Label>
            <div class="flex gap-1">
              <For each={MEAL_TYPES}>
                {(m) => (
                  <Button
                    variant={mealType() === m ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMealType(m)}
                    class="capitalize flex-1"
                  >
                    {m}
                  </Button>
                )}
              </For>
            </div>
          </div>

          {/* Serving */}
          <div class="grid gap-2">
            <Label>Serving</Label>
            <Show
              when={servings() && servings()!.length > 0}
              fallback={
                <div class="text-sm text-muted-foreground">
                  {servings.loading ? "Loading…" : "No servings available."}
                </div>
              }
            >
              <div class="flex flex-wrap gap-1">
                <For each={servings()}>
                  {(s) => (
                    <Button
                      variant={
                        selectedServingId() === s.id ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSelectedServingId(s.id)}
                    >
                      {s.label}
                      <span class="ml-2 text-xs opacity-70">
                        {s.calories ?? 0} cal
                      </span>
                    </Button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Quantity */}
          <div class="grid gap-2">
            <Label>Quantity</Label>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(0.25, quantity() - 0.5))}
              >
                −
              </Button>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={quantity()}
                onInput={(e) => {
                  const v = parseFloat(e.currentTarget.value);
                  if (!isNaN(v) && v > 0) setQuantity(v);
                }}
                class="w-24 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity() + 0.5)}
              >
                +
              </Button>
              <Show when={selectedServing()}>
                <span class="text-sm text-muted-foreground">
                  × {selectedServing()!.label}
                </span>
              </Show>
            </div>
          </div>

          {/* Preview */}
          <div class="rounded-md border bg-card p-3 flex justify-between items-baseline">
            <span class="text-sm text-muted-foreground">Will log</span>
            <div class="text-base">
              <strong>{previewCal()}</strong>
              <span class="text-muted-foreground"> cal</span>
              <span class="mx-2 text-muted-foreground">·</span>
              <strong>{previewProtein()}g</strong>
              <span class="text-muted-foreground"> protein</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedServingId() || busy()}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
