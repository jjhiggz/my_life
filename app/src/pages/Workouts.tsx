import { createResource, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import LogStrengthDialog from "~/components/LogStrengthDialog";
import LogCardioDialog from "~/components/LogCardioDialog";
import ExerciseHistoryDialog from "~/components/ExerciseHistoryDialog";

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
  notes?: string;
  exercises: LoggedExercise[];
};

type WorkoutDay = {
  date: string;
  workouts: LoggedWorkout[];
};

type WorkoutDaySummary = {
  date: string;
  workout_count: number;
  total_duration_min: number;
  total_sets: number;
  kinds: string;
};

type ExerciseLibraryRow = {
  id: string;
  name: string;
  display_name: string;
  muscle_group?: string;
  equipment?: string;
  default_kind: string;
  use_count: number;
  last_used_at?: string;
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function startOfWeek(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toLocaleDateString("en-CA");
}

function addMonths(date: string, months: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-CA");
}

function fmtMonth(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function fmtWeekRange(date: string): string {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth();
  const sLabel = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (sameMonth) return `${sLabel} – ${e.getDate()}`;
  const eLabel = e.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${sLabel} – ${eLabel}`;
}

function fmtDate(date: string): string {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtWeekday(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtDayNum(date: string): string {
  const d = new Date(date + "T00:00:00");
  return String(d.getDate());
}

function metersToMiles(m?: number): string {
  if (m == null) return "";
  return (m / 1609.344).toFixed(2) + " mi";
}

function describeSet(s: LoggedSet): string {
  const parts: string[] = [];
  if (s.reps != null) parts.push(`${s.reps}`);
  if (s.weight_lbs != null) parts.push(`@ ${s.weight_lbs}lb`);
  if (s.duration_sec != null) parts.push(`${s.duration_sec}s`);
  if (s.distance_m != null) parts.push(`${metersToMiles(s.distance_m)}`);
  if (s.rpe != null) parts.push(`RPE ${s.rpe}`);
  return parts.join(" · ") || "—";
}

const KIND_BADGE: Record<string, string> = {
  strength: "bg-red-500/15 text-red-400",
  cardio: "bg-blue-500/15 text-blue-400",
  mobility: "bg-green-500/15 text-green-400",
  sport: "bg-yellow-500/15 text-yellow-400",
  mixed: "bg-purple-500/15 text-purple-400",
};

type ViewMode = "day" | "week" | "month";

export default function Workouts() {
  const [view, setView] = createSignal<ViewMode>("day");
  const [viewDate, setViewDate] = createSignal(todayIso());
  const [showStrength, setShowStrength] = createSignal(false);
  const [showCardio, setShowCardio] = createSignal(false);
  const [historyLib, setHistoryLib] = createSignal<{
    id: string;
    name: string;
  } | null>(null);

  const [day, { refetch: refetchDay }] = createResource(viewDate, (d) =>
    invoke<WorkoutDay>("list_workouts_for_date", { date: d }),
  );
  const [week, { refetch: refetchWeek }] = createResource(
    () => (view() === "week" ? startOfWeek(viewDate()) : null),
    async (start) => {
      if (!start) return [] as WorkoutDaySummary[];
      return invoke<WorkoutDaySummary[]>("list_workouts_week", {
        startDate: start,
      });
    },
  );
  const [month, { refetch: refetchMonth }] = createResource(
    () => {
      if (view() !== "month") return null;
      const d = new Date(viewDate() + "T00:00:00");
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    },
    async (ym) => {
      if (!ym) return [] as WorkoutDaySummary[];
      return invoke<WorkoutDaySummary[]>("list_workouts_month", {
        year: ym.year,
        month: ym.month,
      });
    },
  );
  const [recent, { refetch: refetchRecent }] = createResource(() =>
    invoke<ExerciseLibraryRow[]>("list_exercises", {
      order: "recent",
      limit: 8,
    }),
  );
  const [frequent, { refetch: refetchFrequent }] = createResource(() =>
    invoke<ExerciseLibraryRow[]>("list_exercises", {
      order: "frequent",
      limit: 8,
    }),
  );

  const refreshAll = () => {
    refetchDay();
    refetchWeek();
    refetchMonth();
    refetchRecent();
    refetchFrequent();
  };

  const handleDeleteWorkout = async (w: LoggedWorkout) => {
    if (!confirm(`Delete this workout?`)) return;
    try {
      await invoke("delete_workout", { activityId: w.activity_id });
      refreshAll();
    } catch (e) {
      console.error("delete workout failed", e);
    }
  };

  const isToday = () => viewDate() === todayIso();

  return (
    <div class="p-8 space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold tracking-tight">Workouts</h1>
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-md border border-border bg-card p-1">
            <Button
              variant={view() === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("day")}
            >
              Day
            </Button>
            <Button
              variant={view() === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
            >
              Week
            </Button>
            <Button
              variant={view() === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
            >
              Month
            </Button>
          </div>
          {/* Unified period nav so the ← / label / → positions don't shift
              when switching between Day / Week / Month. Today button has a
              reserved slot on the left — invisible when not applicable. */}
          <Button
            variant="secondary"
            size="sm"
            classList={{ invisible: view() !== "day" || isToday() }}
            onClick={() => setViewDate(todayIso())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (view() === "day") setViewDate(addDays(viewDate(), -1));
              else if (view() === "week") setViewDate(addDays(viewDate(), -7));
              else setViewDate(addMonths(viewDate(), -1));
            }}
          >
            ←
          </Button>
          <span class="font-medium w-[160px] text-center text-sm">
            {view() === "day"
              ? fmtDate(viewDate())
              : view() === "week"
                ? fmtWeekRange(viewDate())
                : fmtMonth(viewDate())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (view() === "day") setViewDate(addDays(viewDate(), 1));
              else if (view() === "week") setViewDate(addDays(viewDate(), 7));
              else setViewDate(addMonths(viewDate(), 1));
            }}
            disabled={view() === "day" && isToday()}
          >
            →
          </Button>
        </div>
      </header>

      <Show when={view() === "day"}>
        <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section class="space-y-3">
            <Show when={day.loading && !day.latest}>
              <div class="text-sm text-muted-foreground">Loading…</div>
            </Show>
            <Show
              when={
                day.latest && day.latest.workouts.length === 0 && !day.loading
              }
            >
              <Card class="border-dashed">
                <CardContent class="pt-6 text-center text-sm text-muted-foreground">
                  {isToday()
                    ? "No workouts logged today. Add one →"
                    : "Nothing logged on this day."}
                </CardContent>
              </Card>
            </Show>
            <For each={day.latest?.workouts ?? []}>
              {(w) => (
                <WorkoutCard
                  workout={w}
                  onDelete={() => handleDeleteWorkout(w)}
                  onPickExercise={(libId, name) =>
                    setHistoryLib({ id: libId, name })
                  }
                />
              )}
            </For>
          </section>

          <Show when={isToday()}>
            <aside class="space-y-4">
              <div class="space-y-2">
                <Button
                  class="w-full"
                  onClick={() => setShowStrength(true)}
                >
                  + Log strength workout
                </Button>
                <Button
                  variant="outline"
                  class="w-full"
                  onClick={() => setShowCardio(true)}
                >
                  + Log cardio workout
                </Button>
              </div>

              <ExerciseList
                title="Recent"
                items={recent.latest ?? []}
                onPick={(row) =>
                  setHistoryLib({ id: row.id, name: row.display_name })
                }
              />
              <ExerciseList
                title="Frequent"
                items={frequent.latest ?? []}
                onPick={(row) =>
                  setHistoryLib({ id: row.id, name: row.display_name })
                }
              />
            </aside>
          </Show>
        </div>
      </Show>

      <Show when={view() === "week"}>
        <WeekView
          days={week.latest ?? []}
          loading={!!week.loading && !week.latest}
          onPickDay={(d) => {
            setViewDate(d);
            setView("day");
          }}
        />
      </Show>

      <Show when={view() === "month"}>
        <MonthView
          days={month.latest ?? []}
          loading={!!month.loading && !month.latest}
          onPickDay={(d) => {
            setViewDate(d);
            setView("day");
          }}
        />
      </Show>

      <LogStrengthDialog
        open={showStrength()}
        onClose={() => setShowStrength(false)}
        onLogged={refreshAll}
      />
      <LogCardioDialog
        open={showCardio()}
        onClose={() => setShowCardio(false)}
        onLogged={refreshAll}
      />
      <ExerciseHistoryDialog
        libId={historyLib()?.id ?? null}
        displayName={historyLib()?.name ?? ""}
        onClose={() => setHistoryLib(null)}
      />
    </div>
  );
}

function WorkoutCard(props: {
  workout: LoggedWorkout;
  onDelete: () => void;
  onPickExercise: (libId: string, name: string) => void;
}) {
  const w = props.workout;
  const kind = w.kind ?? "strength";
  return (
    <Card>
      <CardHeader class="flex-row items-start justify-between space-y-0 p-4 pb-2">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <Badge class={KIND_BADGE[kind] ?? "bg-muted text-muted-foreground"}>
              {kind}
            </Badge>
            <Show when={w.modality}>
              <Badge variant="outline">{w.modality}</Badge>
            </Show>
          </div>
          <CardTitle class="text-base leading-tight">
            <A
              href={`/activity/${w.activity_id}`}
              class="hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {w.title ?? w.workout_type}
            </A>
          </CardTitle>
          <div class="text-xs text-muted-foreground">
            <Show when={w.duration_min}>
              <span>{w.duration_min} min</span>
            </Show>
            <Show when={w.distance_m}>
              <span class="ml-2">{metersToMiles(w.distance_m)}</span>
            </Show>
            <Show when={w.avg_hr}>
              <span class="ml-2">{w.avg_hr} bpm</span>
            </Show>
            <span class="ml-2">{fmtTime(w.created_at)}</span>
          </div>
        </div>
        <button
          class="text-muted-foreground hover:text-destructive"
          onClick={() => props.onDelete()}
          title="Delete workout"
        >
          ×
        </button>
      </CardHeader>
      <Show when={w.exercises.length > 0}>
        <CardContent class="p-4 pt-2 space-y-2">
          <For each={w.exercises}>
            {(ex) => (
              <div class="border-l-2 border-border pl-3 space-y-1">
                <div class="flex items-center justify-between">
                  <button
                    class="text-sm font-medium hover:underline"
                    onClick={() =>
                      ex.exercise_lib_id &&
                      props.onPickExercise(ex.exercise_lib_id, ex.exercise_name)
                    }
                  >
                    {ex.exercise_name}
                  </button>
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
                  <div class="text-xs italic text-muted-foreground">
                    {ex.notes}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </CardContent>
      </Show>
      <Show when={w.notes && w.exercises.length === 0}>
        <CardContent class="p-4 pt-0 text-xs italic text-muted-foreground">
          {w.notes}
        </CardContent>
      </Show>
    </Card>
  );
}

function ExerciseList(props: {
  title: string;
  items: ExerciseLibraryRow[];
  onPick: (row: ExerciseLibraryRow) => void;
}) {
  return (
    <div>
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {props.title}
      </h3>
      <Show when={props.items.length === 0}>
        <div class="text-xs text-muted-foreground">—</div>
      </Show>
      <div class="space-y-1">
        <For each={props.items}>
          {(row) => (
            <button
              class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => props.onPick(row)}
            >
              <span class="truncate">{row.display_name}</span>
              <span class="ml-2 text-xs text-muted-foreground">
                {row.use_count}
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

function WeekView(props: {
  days: WorkoutDaySummary[];
  loading: boolean;
  onPickDay: (date: string) => void;
}) {
  return (
    <div>
      <Show when={props.loading}>
        <div class="text-sm text-muted-foreground">Loading…</div>
      </Show>
      <div class="grid grid-cols-7 gap-2">
        <For each={props.days}>
          {(d) => {
            const isToday = d.date === todayIso();
            const future = d.date > todayIso();
            return (
              <Card
                class={`p-3 transition-colors ${
                  future ? "opacity-50" : "cursor-pointer hover:bg-accent/30"
                } ${isToday ? "ring-1 ring-primary" : ""}`}
                onClick={() => !future && props.onPickDay(d.date)}
              >
                <div class="flex items-baseline justify-between">
                  <span class="text-xs uppercase text-muted-foreground">
                    {fmtWeekday(d.date)}
                  </span>
                  <span class="text-lg font-semibold">{fmtDayNum(d.date)}</span>
                </div>
                <Show when={!future}>
                  <div class="mt-2 text-sm">
                    <Show when={d.workout_count > 0} fallback={<span class="text-muted-foreground">rest</span>}>
                      <div class="font-medium">{d.workout_count} workout{d.workout_count === 1 ? "" : "s"}</div>
                      <div class="text-xs text-muted-foreground">
                        {d.total_duration_min} min · {d.total_sets} sets
                      </div>
                    </Show>
                  </div>
                </Show>
              </Card>
            );
          }}
        </For>
      </div>
    </div>
  );
}

function MonthView(props: {
  days: WorkoutDaySummary[];
  loading: boolean;
  onPickDay: (date: string) => void;
}) {
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cells = () => {
    const days = props.days;
    if (days.length === 0) return [];
    const first = new Date(days[0].date + "T00:00:00");
    const leading = first.getDay();
    const out: (WorkoutDaySummary | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    out.push(...days);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  };
  const heat = (d: WorkoutDaySummary): string => {
    if (d.workout_count === 0) return "transparent";
    if (d.workout_count === 1) return "rgba(123, 217, 123, 0.4)";
    return "rgba(123, 217, 123, 0.7)";
  };
  return (
    <div>
      <Show when={props.loading}>
        <div class="text-sm text-muted-foreground">Loading…</div>
      </Show>
      <Show when={!props.loading}>
        <div class="grid grid-cols-7 gap-1 mb-2 text-xs text-muted-foreground">
          <For each={WEEKDAYS}>{(w) => <div class="text-center">{w}</div>}</For>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <For each={cells()}>
            {(c) => (
              <Show
                when={c}
                fallback={<div class="aspect-square rounded-md" />}
              >
                <button
                  class="aspect-square rounded-md border border-border p-1 text-left text-xs hover:bg-accent/30"
                  style={{ "background-color": heat(c!) }}
                  onClick={() => props.onPickDay(c!.date)}
                  title={`${c!.date} · ${c!.workout_count} workout${c!.workout_count === 1 ? "" : "s"}`}
                >
                  <div>{fmtDayNum(c!.date)}</div>
                  <Show when={c!.workout_count > 0}>
                    <div class="text-[10px] text-foreground/70">
                      {c!.total_sets} sets
                    </div>
                  </Show>
                </button>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
