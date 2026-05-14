import { createResource, Show, type ParentComponent } from "solid-js";
import { invoke } from "~/lib/telemetry";

type TopWorkoutKind = {
  name: string;
  count: number;
};

type WorkoutStats = {
  period_label: string;
  days_logged: number;
  workout_count: number;
  total_duration_min: number;
  cardio_min: number;
  strength_min: number;
  other_min: number;
  total_sets: number;
  strength_sets: number;
  total_volume_lbs: number;
  cardio_distance_m: number;
  calories_burned: number;
  estimated_calories: number;
  avg_calories_per_workout: number;
  estimated_calories_fallback: number;
  top_kind: TopWorkoutKind | null;
};

type View = "day" | "week" | "month";
type Tone = "positive" | "warning" | "neutral";

const StatCard: ParentComponent<{
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}> = (props) => (
  <div class="insight-card" classList={{ [`tone-${props.tone ?? "neutral"}`]: true }}>
    <div class="insight-label">{props.label}</div>
    <div class="insight-value">{props.value}</div>
    <Show when={props.hint}>
      <div class="insight-hint">{props.hint}</div>
    </Show>
  </div>
);

function miles(meters: number): string {
  return (meters / 1609.344).toFixed(1);
}

function pounds(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function periodKey(props: {
  view: View;
  date: string;
  weekStart: string;
}): string {
  if (props.view === "week") return `week:${props.weekStart}`;
  if (props.view === "month") {
    const d = new Date(props.date + "T00:00:00");
    return `month:${d.getFullYear()}-${d.getMonth() + 1}`;
  }
  return `day:${props.date}`;
}

function fetchStats(props: {
  view: View;
  date: string;
  weekStart: string;
}): Promise<WorkoutStats> {
  if (props.view === "week") {
    return invoke<WorkoutStats>("workout_week_stats", {
      startDate: props.weekStart,
    });
  }
  if (props.view === "month") {
    const d = new Date(props.date + "T00:00:00");
    return invoke<WorkoutStats>("workout_month_stats", {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return invoke<WorkoutStats>("workout_day_stats", { date: props.date });
}

export default function WorkoutStatsBar(props: {
  view: View;
  date: string;
  weekStart: string;
}) {
  const [stats] = createResource(
    () => periodKey(props),
    () => fetchStats(props),
  );
  const hasLoggedCalories = () => (stats()?.calories_burned ?? 0) > 0;
  const calorieSource = () => {
    const s = stats();
    if (!s || s.calories_burned <= 0) return "estimated";
    return s.estimated_calories > s.calories_burned ? "logged + estimated" : "logged";
  };

  return (
    <Show when={stats() && stats()!.workout_count > 0}>
      <div class="insights-strip">
        <StatCard
          label={hasLoggedCalories() ? "Calories burned" : "Est. calories"}
          value={String(stats()!.estimated_calories)}
          hint={`${Math.round(stats()!.avg_calories_per_workout)} / workout · ${
            calorieSource()
          }`}
          tone="positive"
        />
        <StatCard
          label="Cardio"
          value={`${stats()!.cardio_min} min`}
          hint={`${miles(stats()!.cardio_distance_m)} mi logged`}
          tone={stats()!.cardio_min > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Strength"
          value={`${stats()!.strength_min} min`}
          hint={`${stats()!.strength_sets} sets`}
          tone={stats()!.strength_min > 0 || stats()!.strength_sets > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Volume"
          value={`${pounds(stats()!.total_volume_lbs)} lb`}
          hint="reps × weight"
        />
        <StatCard
          label="Workouts"
          value={String(stats()!.workout_count)}
          hint={`${stats()!.days_logged} day${stats()!.days_logged === 1 ? "" : "s"} logged`}
        />
        <Show when={stats()!.top_kind}>
          <StatCard
            label="Most logged"
            value={stats()!.top_kind!.name}
            hint={`${stats()!.top_kind!.count}× ${stats()!.period_label}`}
          />
        </Show>
      </div>
    </Show>
  );
}
