import { createEffect, createSignal, For, Show } from "solid-js";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type SetDraft = {
  reps?: number;
  weight_lbs?: number;
  duration_sec?: number;
};

type ExerciseDraft = {
  name: string;
  kind: "strength" | "timed";
  sets: SetDraft[];
};

export type StrengthPrefill = {
  title?: string;
  durationMin?: number;
  exercises: { name: string; kind: "strength" | "timed"; setCount: number }[];
};

export default function LogStrengthDialog(props: {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
  prefill?: StrengthPrefill | null;
}) {
  const [title, setTitle] = createSignal("");
  const [duration, setDuration] = createSignal<number | undefined>(undefined);
  const [exercises, setExercises] = createSignal<ExerciseDraft[]>([]);
  const [busy, setBusy] = createSignal(false);

  // When the dialog opens and prefill is set, seed state with the planned exercises.
  let lastOpen = false;
  createEffect(() => {
    const opening = props.open && !lastOpen;
    lastOpen = props.open;
    if (opening && props.prefill) {
      setTitle(props.prefill.title ?? "");
      setDuration(props.prefill.durationMin);
      setExercises(
        props.prefill.exercises.map((e) => ({
          name: e.name,
          kind: e.kind,
          sets: Array.from({ length: Math.max(1, e.setCount) }, () => ({})),
        })),
      );
    }
  });

  const reset = () => {
    setTitle("");
    setDuration(undefined);
    setExercises([]);
  };

  const addExercise = () => {
    setExercises((xs) => [
      ...xs,
      { name: "", kind: "strength", sets: [{ reps: undefined }] },
    ]);
  };

  const updateExercise = (idx: number, patch: Partial<ExerciseDraft>) => {
    setExercises((xs) => xs.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeExercise = (idx: number) => {
    setExercises((xs) => xs.filter((_, i) => i !== idx));
  };

  const addSet = (exIdx: number) => {
    setExercises((xs) =>
      xs.map((e, i) =>
        i === exIdx ? { ...e, sets: [...e.sets, {}] } : e,
      ),
    );
  };

  const updateSet = (
    exIdx: number,
    setIdx: number,
    patch: Partial<SetDraft>,
  ) => {
    setExercises((xs) =>
      xs.map((e, i) =>
        i === exIdx
          ? {
              ...e,
              sets: e.sets.map((s, j) =>
                j === setIdx ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((xs) =>
      xs.map((e, i) =>
        i === exIdx ? { ...e, sets: e.sets.filter((_, j) => j !== setIdx) } : e,
      ),
    );
  };

  const handleSubmit = async () => {
    if (busy()) return;
    const cleaned = exercises()
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        exercise_name: e.name.trim(),
        kind: e.kind,
        sets: e.sets,
      }));
    if (cleaned.length === 0) return;
    setBusy(true);
    try {
      await invoke("log_strength_workout", {
        title: title().trim() || null,
        durationMin: duration() ?? null,
        energyBefore: null,
        energyAfter: null,
        location: null,
        notes: null,
        exercises: cleaned,
      });
      props.onLogged();
      reset();
      props.onClose();
    } catch (e) {
      console.error("log strength workout failed", e);
      alert(`Failed: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          props.onClose();
        }
      }}
    >
      <DialogContent class="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log strength workout</DialogTitle>
          <DialogDescription>
            Name the session, add exercises, fill in sets.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <div class="grid grid-cols-3 gap-2">
            <Input
              placeholder="Focus (e.g. Upper body + core)"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              class="col-span-2"
            />
            <Input
              type="number"
              placeholder="Duration (min)"
              value={duration() ?? ""}
              onInput={(e) =>
                setDuration(
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined,
                )
              }
            />
          </div>

          <For each={exercises()}>
            {(ex, i) => (
              <div class="rounded-md border border-border p-3 space-y-2">
                <div class="flex items-center gap-2">
                  <Input
                    placeholder="Exercise name"
                    value={ex.name}
                    onInput={(e) =>
                      updateExercise(i(), { name: e.currentTarget.value })
                    }
                    class="flex-1"
                  />
                  <select
                    value={ex.kind}
                    onChange={(e) =>
                      updateExercise(i(), {
                        kind: e.currentTarget.value as "strength" | "timed",
                      })
                    }
                    class="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="strength">reps</option>
                    <option value="timed">time</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExercise(i())}
                    title="Remove exercise"
                  >
                    ×
                  </Button>
                </div>
                <div class="space-y-1">
                  <For each={ex.sets}>
                    {(s, j) => (
                      <div class="flex items-center gap-2 text-sm">
                        <span class="w-12 text-muted-foreground">
                          Set {j() + 1}
                        </span>
                        <Show
                          when={ex.kind === "strength"}
                          fallback={
                            <Input
                              type="number"
                              placeholder="seconds"
                              value={s.duration_sec ?? ""}
                              onInput={(e) =>
                                updateSet(i(), j(), {
                                  duration_sec: e.currentTarget.value
                                    ? Number(e.currentTarget.value)
                                    : undefined,
                                })
                              }
                              class="h-8 w-24"
                            />
                          }
                        >
                          <Input
                            type="number"
                            placeholder="reps"
                            value={s.reps ?? ""}
                            onInput={(e) =>
                              updateSet(i(), j(), {
                                reps: e.currentTarget.value
                                  ? Number(e.currentTarget.value)
                                  : undefined,
                              })
                            }
                            class="h-8 w-20"
                          />
                          <Input
                            type="number"
                            placeholder="lbs"
                            value={s.weight_lbs ?? ""}
                            onInput={(e) =>
                              updateSet(i(), j(), {
                                weight_lbs: e.currentTarget.value
                                  ? Number(e.currentTarget.value)
                                  : undefined,
                              })
                            }
                            class="h-8 w-20"
                          />
                        </Show>
                        <button
                          class="ml-auto text-muted-foreground hover:text-foreground"
                          onClick={() => removeSet(i(), j())}
                          title="Remove set"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </For>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addSet(i())}
                    class="text-xs"
                  >
                    + Add set
                  </Button>
                </div>
              </div>
            )}
          </For>

          <Button variant="outline" onClick={addExercise} class="w-full">
            + Add exercise
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy() || exercises().length === 0}>
            Save workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
