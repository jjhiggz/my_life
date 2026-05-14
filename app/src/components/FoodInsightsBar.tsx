import { createResource, Show, type ParentComponent } from "solid-js";
import { invoke } from "~/lib/telemetry";

// Shapes mirror the Rust types in src-tauri/src/lib.rs.
type DayInsights = {
  date: string;
  has_data: boolean;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cal_target: number;
  base_cal_target: number;
  exercise_calories: number;
  protein_target: number;
};

type BestProteinDay = {
  date: string;
  day_label: string;
  protein_g: number;
};

type MostLoggedFood = {
  food_name: string;
  count: number;
};

type PeriodInsights = {
  period_label: string;
  days_logged: number;
  days_in_period: number;
  avg_cal: number;
  avg_protein_g: number;
  cal_target: number;
  protein_target: number;
  best_protein_day: BestProteinDay | null;
  days_under_cal_target: number;
  most_logged: MostLoggedFood | null;
};

type Tone = "positive" | "warning" | "neutral";

const InsightCard: ParentComponent<{
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

function DayInsightsBar(props: { date: string }) {
  const [data] = createResource(
    () => props.date,
    (d) => invoke<DayInsights>("food_day_insights", { date: d }),
  );
  return (
    <Show when={data()?.has_data}>
      <div class="insights-strip">
        <InsightCard
          label="Calories"
          value={String(data()!.calories)}
          hint={
            data()!.exercise_calories > 0
              ? `/ ${data()!.cal_target} target (${data()!.base_cal_target} + ${data()!.exercise_calories})`
              : `/ ${data()!.cal_target} target`
          }
          tone={
            data()!.calories === 0
              ? "neutral"
              : data()!.calories <= data()!.cal_target
                ? "positive"
                : "warning"
          }
        />
        <InsightCard
          label="Protein"
          value={`${Math.round(data()!.protein_g)}g`}
          hint={`/ ${Math.round(data()!.protein_target)}g target`}
          tone={
            data()!.protein_g >= data()!.protein_target * 0.8
              ? "positive"
              : "warning"
          }
        />
      </div>
    </Show>
  );
}

function PeriodBar(props: { data: PeriodInsights | undefined }) {
  return (
    <Show when={props.data && props.data.days_logged > 0}>
      <div class="insights-strip">
        <InsightCard
          label={`Avg cal/day (${props.data!.days_logged}d logged)`}
          value={String(Math.round(props.data!.avg_cal))}
          tone={
            props.data!.avg_cal <= props.data!.cal_target ? "positive" : "warning"
          }
        />
        <InsightCard
          label="Avg protein/day"
          value={`${Math.round(props.data!.avg_protein_g)}g`}
          tone={
            props.data!.avg_protein_g >= props.data!.protein_target * 0.8
              ? "positive"
              : "warning"
          }
        />
        <Show when={props.data!.best_protein_day}>
          <InsightCard
            label="Best protein day"
            value={`${props.data!.best_protein_day!.day_label}: ${Math.round(
              props.data!.best_protein_day!.protein_g,
            )}g`}
          />
        </Show>
        <InsightCard
          label="Under cal target"
          value={`${props.data!.days_under_cal_target}/${props.data!.days_logged}`}
          hint={`days ${props.data!.period_label}`}
          tone={
            props.data!.days_logged === 0
              ? "neutral"
              : props.data!.days_under_cal_target / props.data!.days_logged >= 0.7
                ? "positive"
                : props.data!.days_under_cal_target === 0
                  ? "warning"
                  : "neutral"
          }
        />
        <Show when={props.data!.most_logged}>
          <InsightCard
            label="Most logged"
            value={props.data!.most_logged!.food_name}
            hint={`${props.data!.most_logged!.count}× ${props.data!.period_label}`}
          />
        </Show>
      </div>
    </Show>
  );
}

function WeekInsightsBar(props: { weekStart: string }) {
  const [data] = createResource(
    () => props.weekStart,
    (s) => invoke<PeriodInsights>("food_week_insights", { startDate: s }),
  );
  return <PeriodBar data={data()} />;
}

function MonthInsightsBar(props: { year: number; month: number }) {
  const [data] = createResource(
    () => `${props.year}-${props.month}`,
    () => invoke<PeriodInsights>("food_month_insights", {
      year: props.year,
      month: props.month,
    }),
  );
  return <PeriodBar data={data()} />;
}

export type View = "day" | "week" | "month";

/** Dispatcher: picks the right insights bar for the current view. */
export default function FoodInsightsBar(props: {
  view: View;
  date: string;       // YYYY-MM-DD reference date (e.g. viewDate from the page)
  weekStart: string;  // Sunday-start of the active week, YYYY-MM-DD
}) {
  return (
    <>
      <Show when={props.view === "day"}>
        <DayInsightsBar date={props.date} />
      </Show>
      <Show when={props.view === "week"}>
        <WeekInsightsBar weekStart={props.weekStart} />
      </Show>
      <Show when={props.view === "month"}>
        <MonthInsightsBar
          year={new Date(props.date + "T00:00:00").getFullYear()}
          month={new Date(props.date + "T00:00:00").getMonth() + 1}
        />
      </Show>
    </>
  );
}
