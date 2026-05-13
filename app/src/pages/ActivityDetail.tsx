import { createResource, createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { marked } from "marked";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";

type Tag = string;

type ActivityRow = {
  id: string;
  activity_type: string;
  created_at: string;
  updated_at?: string;
  status: string;
  title?: string;
  notes?: string;
  tags: Tag[];
};

type LoggedSet = {
  id: string;
  set_number: number;
  reps?: number;
  weight_lbs?: number;
  duration_sec?: number;
  distance_m?: number;
  rpe?: number;
  notes?: string;
};

type LoggedExercise = {
  id: string;
  exercise_name: string;
  exercise_order: number;
  kind: string;
  exercise_lib_id?: string;
  notes?: string;
  sets: LoggedSet[];
};

type LoggedWorkout = {
  activity_id: string;
  created_at: string;
  kind?: string;
  workout_type: string;
  modality?: string;
  duration_min?: number;
  distance_m?: number;
  elevation_m?: number;
  avg_hr?: number;
  title?: string;
  exercises: LoggedExercise[];
};

type LoggedMealItem = {
  id: string;
  food_name: string;
  serving_size?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  quantity?: number;
};

type LoggedMeal = {
  meal_type: string;
  total_calories?: number;
  total_protein_g?: number;
  total_carbs_g?: number;
  total_fat_g?: number;
  items: LoggedMealItem[];
};

type ActivityPayload =
  | { kind: "workout"; data: LoggedWorkout }
  | { kind: "meal"; data: LoggedMeal }
  | { kind: "none" };

type ActivityDetail = {
  activity: ActivityRow;
  payload: ActivityPayload;
  note_md: string;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function describeSet(s: LoggedSet): string {
  const parts: string[] = [];
  if (s.reps != null) parts.push(`${s.reps}`);
  if (s.weight_lbs != null) parts.push(`@ ${s.weight_lbs}lb`);
  if (s.duration_sec != null) parts.push(`${s.duration_sec}s`);
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  return parts.join(" · ") || "—";
}

const TYPE_TONE: Record<string, string> = {
  workout: "bg-red-500/15 text-red-400",
  meal: "bg-orange-500/15 text-orange-400",
  task: "bg-blue-500/15 text-blue-400",
  checkin: "bg-yellow-500/15 text-yellow-400",
  garden: "bg-green-500/15 text-green-400",
};

const STATUS_TONE: Record<string, string> = {
  done: "bg-green-500/15 text-green-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  planned: "bg-zinc-500/15 text-zinc-400",
  skipped: "bg-zinc-500/15 text-zinc-500",
};

export default function ActivityDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [refreshTick, setRefreshTick] = createSignal(0);

  const [detail] = createResource(
    () => `${params.id}|${refreshTick()}`,
    async () => invoke<ActivityDetail>("get_activity", { activityId: params.id }),
  );

  const reloadNote = async () => {
    const md = await invoke<string>("read_activity_note", {
      activityId: params.id,
    });
    setRefreshTick((t) => t + 1);
    return md;
  };

  // Re-read the note when the window regains focus (after editing externally).
  onMount(() => {
    const onFocus = () => reloadNote();
    window.addEventListener("focus", onFocus);
    onCleanup(() => window.removeEventListener("focus", onFocus));
  });

  const openInEditor = async () => {
    try {
      await invoke("open_activity_note", {
        activityId: params.id,
        title: detail()?.activity.title ?? detail()?.activity.activity_type ?? "",
      });
    } catch (e) {
      console.error("open_activity_note failed", e);
      alert(`Failed to open editor: ${e}`);
    }
  };

  const renderedBody = () => {
    const md = detail()?.note_md ?? "";
    if (!md.trim()) return "";
    return marked.parse(md) as string;
  };

  return (
    <div class="p-8 max-w-5xl">
      <div class="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
      </div>

      <Show when={detail.loading && !detail.latest}>
        <div class="text-sm text-muted-foreground">Loading…</div>
      </Show>

      <Show when={detail.error}>
        <Card class="border-destructive/40">
          <CardContent class="pt-6 text-sm text-destructive">
            {String(detail.error)}
          </CardContent>
        </Card>
      </Show>

      <Show when={detail.latest}>
        <div class="grid gap-6 lg:grid-cols-[1fr_240px]">
          <main class="space-y-6 min-w-0">
            <header>
              <h1 class="text-3xl font-semibold tracking-tight">
                {detail()!.activity.title ?? `${detail()!.activity.activity_type} activity`}
              </h1>
              <div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{fmtDate(detail()!.activity.created_at)}</span>
                <span>·</span>
                <span class="font-mono text-xs">{detail()!.activity.id.slice(0, 8)}</span>
              </div>
            </header>

            {/* Markdown body */}
            <section>
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </h2>
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={reloadNote}>
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={openInEditor}>
                    Open in editor
                  </Button>
                </div>
              </div>
              <Show
                when={renderedBody()}
                fallback={
                  <Card class="border-dashed">
                    <CardContent class="pt-6 pb-6 text-center text-sm text-muted-foreground">
                      No description yet. Click <span class="font-medium">Open in editor</span> to
                      add one — a starter file will be created at{" "}
                      <code class="rounded bg-muted px-1.5 py-0.5">
                        notes/{detail()!.activity.id}.md
                      </code>
                      .
                    </CardContent>
                  </Card>
                }
              >
                <div class="plan-body" innerHTML={renderedBody()} />
              </Show>
            </section>

            {/* Type-specific subsection */}
            <Show when={detail()!.payload.kind === "workout"}>
              <WorkoutDetailSection
                workout={(detail()!.payload as { kind: "workout"; data: LoggedWorkout }).data}
              />
            </Show>
            <Show when={detail()!.payload.kind === "meal"}>
              <MealDetailSection
                meal={(detail()!.payload as { kind: "meal"; data: LoggedMeal }).data}
              />
            </Show>
          </main>

          <aside class="space-y-4">
            <div class="rounded-lg border border-border bg-card/40 p-4 space-y-3">
              <div>
                <div class="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Status
                </div>
                <Badge
                  class={
                    STATUS_TONE[detail()!.activity.status] ?? "bg-muted text-muted-foreground"
                  }
                >
                  {detail()!.activity.status.replace("_", " ")}
                </Badge>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Type
                </div>
                <Badge
                  class={
                    TYPE_TONE[detail()!.activity.activity_type] ?? "bg-muted text-muted-foreground"
                  }
                >
                  {detail()!.activity.activity_type}
                </Badge>
              </div>
              <Show when={detail()!.activity.tags.length > 0}>
                <div>
                  <div class="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Tags
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <For each={detail()!.activity.tags}>
                      {(t) => <Badge variant="outline">{t}</Badge>}
                    </For>
                  </div>
                </div>
              </Show>
              <Show when={detail()!.activity.notes}>
                <div>
                  <div class="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Quick note
                  </div>
                  <div class="text-sm">{detail()!.activity.notes}</div>
                </div>
              </Show>
            </div>
          </aside>
        </div>
      </Show>
    </div>
  );
}

function WorkoutDetailSection(props: { workout: LoggedWorkout }) {
  const w = props.workout;
  return (
    <section>
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Workout
      </h2>
      <Card>
        <CardContent class="pt-4 space-y-2">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <Badge>{w.kind ?? w.workout_type}</Badge>
            <Show when={w.modality}>
              <Badge variant="outline">{w.modality}</Badge>
            </Show>
            <Show when={w.duration_min}>
              <span class="text-muted-foreground">{w.duration_min} min</span>
            </Show>
            <Show when={w.distance_m}>
              <span class="text-muted-foreground">
                {(w.distance_m! / 1609.344).toFixed(2)} mi
              </span>
            </Show>
            <Show when={w.avg_hr}>
              <span class="text-muted-foreground">{w.avg_hr} bpm</span>
            </Show>
          </div>
          <Show when={w.exercises.length > 0}>
            <div class="space-y-2 pt-1">
              <For each={w.exercises}>
                {(ex) => (
                  <div class="border-l-2 border-border pl-3 space-y-1">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-medium">{ex.exercise_name}</span>
                      <span class="text-xs text-muted-foreground">
                        {ex.sets.length} set{ex.sets.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <For each={ex.sets}>
                        {(s) => (
                          <span>
                            <span class="text-foreground/70">#{s.set_number}</span>{" "}
                            {describeSet(s)}
                          </span>
                        )}
                      </For>
                    </div>
                    <Show when={ex.notes}>
                      <div class="text-xs italic text-muted-foreground">{ex.notes}</div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </CardContent>
      </Card>
    </section>
  );
}

function MealDetailSection(props: { meal: LoggedMeal }) {
  const m = props.meal;
  return (
    <section>
      <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Meal
      </h2>
      <Card>
        <CardContent class="pt-4 space-y-2">
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <Badge>{m.meal_type}</Badge>
            <Show when={m.total_calories != null}>
              <span class="text-muted-foreground">{m.total_calories} cal</span>
            </Show>
            <Show when={m.total_protein_g != null}>
              <span class="text-muted-foreground">
                {Math.round(m.total_protein_g!)}g protein
              </span>
            </Show>
          </div>
          <Show when={m.items.length > 0}>
            <div class="space-y-1 pt-1">
              <For each={m.items}>
                {(it) => (
                  <div class="flex items-center justify-between text-sm border-l-2 border-border pl-3">
                    <div>
                      <span class="font-medium">{it.food_name}</span>
                      <Show when={it.serving_size}>
                        <span class="ml-2 text-xs text-muted-foreground">
                          {it.serving_size}
                        </span>
                      </Show>
                    </div>
                    <span class="text-xs text-muted-foreground">
                      {it.calories ?? 0} cal · {Math.round(it.protein_g ?? 0)}g
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </CardContent>
      </Card>
    </section>
  );
}
