import { createResource, For, Show } from "solid-js";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type LoggedSet = {
  id: string;
  set_number: number;
  reps?: number;
  weight_lbs?: number;
  duration_sec?: number;
  distance_m?: number;
  rpe?: number;
};

type HistoryEntry = {
  date: string;
  workout_activity_id: string;
  workout_title?: string;
  sets: LoggedSet[];
};

function describeSet(s: LoggedSet): string {
  const parts: string[] = [];
  if (s.reps != null) parts.push(`${s.reps} reps`);
  if (s.weight_lbs != null) parts.push(`${s.weight_lbs}lb`);
  if (s.duration_sec != null) parts.push(`${s.duration_sec}s`);
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  return parts.join(" · ") || "—";
}

function bestSet(sets: LoggedSet[]): LoggedSet | undefined {
  // For strength-y sets prefer max weight, then reps. For timed sets prefer max duration.
  const hasWeight = sets.some((s) => s.weight_lbs != null);
  const hasDuration = sets.some((s) => s.duration_sec != null);
  if (hasWeight) {
    return [...sets].sort(
      (a, b) =>
        (b.weight_lbs ?? 0) - (a.weight_lbs ?? 0) ||
        (b.reps ?? 0) - (a.reps ?? 0),
    )[0];
  }
  if (hasDuration) {
    return [...sets].sort(
      (a, b) => (b.duration_sec ?? 0) - (a.duration_sec ?? 0),
    )[0];
  }
  return [...sets].sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0))[0];
}

export default function ExerciseHistoryDialog(props: {
  libId: string | null;
  displayName: string;
  onClose: () => void;
}) {
  const [history] = createResource(
    () => props.libId,
    async (id) => {
      if (!id) return [] as HistoryEntry[];
      return invoke<HistoryEntry[]>("exercise_history", {
        libId: id,
        limit: 20,
      });
    },
  );

  const best = () => {
    const all = history()?.flatMap((h) => h.sets) ?? [];
    return all.length > 0 ? bestSet(all) : undefined;
  };

  return (
    <Dialog
      open={props.libId !== null}
      onOpenChange={(o) => {
        if (!o) props.onClose();
      }}
    >
      <DialogContent class="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.displayName} — history</DialogTitle>
          <DialogDescription>
            Most recent sessions, newest first.
          </DialogDescription>
        </DialogHeader>

        <Show when={best()}>
          <div class="rounded-md border border-border bg-accent/30 p-3">
            <div class="text-xs uppercase tracking-wider text-muted-foreground">
              Best set
            </div>
            <div class="text-sm font-medium">{describeSet(best()!)}</div>
          </div>
        </Show>

        <Show when={history.loading}>
          <div class="text-sm text-muted-foreground">Loading…</div>
        </Show>

        <Show when={!history.loading && (history()?.length ?? 0) === 0}>
          <div class="text-sm text-muted-foreground">
            No history yet — log a workout containing this exercise.
          </div>
        </Show>

        <div class="space-y-3">
          <For each={history() ?? []}>
            {(entry) => (
              <div class="rounded-md border border-border p-3 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{entry.date}</span>
                  <Show when={entry.workout_title}>
                    <Badge variant="outline">{entry.workout_title}</Badge>
                  </Show>
                </div>
                <div class="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                  <For each={entry.sets}>
                    {(s) => (
                      <span>
                        <span class="text-foreground/80">#{s.set_number}</span>{" "}
                        {describeSet(s)}
                      </span>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>

        <div class="flex justify-end pt-2">
          <Button variant="outline" onClick={() => props.onClose()}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
