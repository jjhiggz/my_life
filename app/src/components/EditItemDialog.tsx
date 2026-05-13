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

export type EditableItem = {
  item_id: string;
  food_id: string;
  food_name: string;
  serving_id?: string;
  quantity?: number;
};

export default function EditItemDialog(props: {
  item: EditableItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [servings] = createResource(
    () => props.item?.food_id,
    async (id) => {
      if (!id) return [];
      return invoke<Serving[]>("list_food_servings", { foodId: id });
    },
  );

  const [selectedServingId, setSelectedServingId] = createSignal<string>("");
  const [quantity, setQuantity] = createSignal<number>(1);
  const [busy, setBusy] = createSignal(false);

  // Initialize fields when item changes
  createEffect(() => {
    const it = props.item;
    if (it) {
      setSelectedServingId(it.serving_id ?? "");
      setQuantity(it.quantity ?? 1);
    }
  });

  // If no serving was on the item, auto-select first when servings load
  createEffect(() => {
    const list = servings();
    if (list && list.length > 0 && !selectedServingId()) {
      setSelectedServingId(list[0].id);
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

  const handleSave = async () => {
    if (!props.item || !selectedServingId() || busy()) return;
    setBusy(true);
    try {
      await invoke("update_meal_item", {
        itemId: props.item.item_id,
        servingId: selectedServingId(),
        quantity: quantity(),
      });
      props.onSaved();
      props.onClose();
    } catch (e) {
      console.error("update_meal_item failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!props.item}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit: {props.item?.food_name ?? ""}</DialogTitle>
          <DialogDescription>
            Change the serving or quantity.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-2">
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

          <div class="rounded-md border bg-card p-3 flex justify-between items-baseline">
            <span class="text-sm text-muted-foreground">Will save</span>
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
          <Button onClick={handleSave} disabled={!selectedServingId() || busy()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
