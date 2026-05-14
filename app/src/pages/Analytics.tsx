import { createMemo, createResource, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type WeightPoint = {
  id: string;
  activity_id?: string;
  recorded_at: string;
  date: string;
  weight_lbs: number;
  body_fat_pct?: number;
  notes?: string;
};

type WorkoutPoint = {
  date: string;
  workout_count: number;
  total_duration_min: number;
};

type BreakdownItem = {
  key: string;
  label: string;
  count: number;
  total_duration_min?: number;
};

type AnalyticsOverview = {
  weight_points: WeightPoint[];
  workout_points: WorkoutPoint[];
  activity_mix: BreakdownItem[];
  productivity_breakdown: BreakdownItem[];
};

type ChartPoint = {
  x: number;
  y: number;
  label: string;
  value: number;
};

const WIDTH = 760;
const HEIGHT = 300;
const PAD = { top: 24, right: 22, bottom: 34, left: 46 };

async function loadAnalytics(): Promise<AnalyticsOverview> {
  return await invoke<AnalyticsOverview>("analytics_overview");
}

function fmtWeight(v: number | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)} lb`;
}

function fmtSigned(v: number): string {
  if (Math.abs(v) < 0.05) return "0.0 lb";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)} lb`;
}

function shortDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function movingAverage(points: WeightPoint[], windowSize = 7): ChartPoint[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - windowSize + 1), i + 1);
    const avg =
      slice.reduce((sum, item) => sum + item.weight_lbs, 0) / Math.max(1, slice.length);
    return { x: 0, y: 0, label: p.date, value: avg };
  });
}

function linePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function areaPath(points: ChartPoint[], floor: number): string {
  if (points.length === 0) return "";
  return `${linePath(points)} L ${points[points.length - 1].x} ${floor} L ${points[0].x} ${floor} Z`;
}

function buildLinePoints(values: { date: string; value: number }[]): {
  points: ChartPoint[];
  min: number;
  max: number;
} {
  if (values.length === 0) return { points: [], min: 0, max: 1 };
  const rawMin = Math.min(...values.map((p) => p.value));
  const rawMax = Math.max(...values.map((p) => p.value));
  const spread = Math.max(4, rawMax - rawMin);
  const min = Math.floor(rawMin - spread * 0.25);
  const max = Math.ceil(rawMax + spread * 0.25);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  return {
    min,
    max,
    points: values.map((p, i) => {
      const x =
        PAD.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
      const y = PAD.top + ((max - p.value) / Math.max(1, max - min)) * plotH;
      return { x, y, label: p.date, value: p.value };
    }),
  };
}

function scaleLineValues(
  values: { date: string; value: number }[],
  min: number,
  max: number,
): ChartPoint[] {
  if (values.length === 0) return [];
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  return values.map((p, i) => {
    const x =
      PAD.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
    const y = PAD.top + ((max - p.value) / Math.max(1, max - min)) * plotH;
    return { x, y, label: p.date, value: p.value };
  });
}

function buildWorkoutWeeks(points: WorkoutPoint[]): {
  label: string;
  count: number;
  minutes: number;
}[] {
  const now = new Date();
  const first = startOfWeek(addDays(now, -7 * 7));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(first, i * 7);
    return {
      start,
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: 0,
      minutes: 0,
    };
  });
  const byWeek = new Map(weeks.map((w) => [dateKey(w.start), w]));
  for (const point of points) {
    const d = new Date(point.date + "T00:00:00");
    const key = dateKey(startOfWeek(d));
    const week = byWeek.get(key);
    if (!week) continue;
    week.count += point.workout_count;
    week.minutes += point.total_duration_min;
  }
  return weeks;
}

function maxCount(items: BreakdownItem[]): number {
  return Math.max(1, ...items.map((item) => item.count));
}

export default function Analytics() {
  const [analytics, { refetch }] = createResource(loadAnalytics);

  const data = () =>
    analytics.latest ?? {
      weight_points: [],
      workout_points: [],
      activity_mix: [],
      productivity_breakdown: [],
    };

  const weightPoints = () => data().weight_points;
  const currentWeight = () => weightPoints().at(-1)?.weight_lbs;
  const startWeight = () => weightPoints()[0]?.weight_lbs;
  const weightDelta = () => {
    const current = currentWeight();
    const start = startWeight();
    return current == null || start == null ? undefined : current - start;
  };

  const latestWeightActivity = () => weightPoints().at(-1)?.activity_id;

  const lineData = createMemo(() =>
    buildLinePoints(weightPoints().map((p) => ({ date: p.date, value: p.weight_lbs }))),
  );
  const avgData = createMemo(() => {
    const avg = movingAverage(weightPoints());
    return scaleLineValues(
      avg.map((p) => ({ date: p.label, value: p.value })),
      lineData().min,
      lineData().max,
    );
  });
  const workoutWeeks = createMemo(() => buildWorkoutWeeks(data().workout_points));
  const workoutTotal = () =>
    data().workout_points.reduce((sum, p) => sum + p.workout_count, 0);
  const workoutMinutes = () =>
    data().workout_points.reduce((sum, p) => sum + p.total_duration_min, 0);
  const activityTotal = () =>
    data().activity_mix.reduce((sum, item) => sum + item.count, 0);
  const taskTotal = () =>
    data().productivity_breakdown.reduce((sum, item) => sum + item.count, 0);

  const handleLogWeight = async () => {
    const raw = window.prompt("Weight in pounds:");
    if (!raw?.trim()) return;
    const weight = Number(raw);
    if (!Number.isFinite(weight) || weight <= 0) {
      alert("Enter a valid weight.");
      return;
    }
    const notes = window.prompt("Optional note:", "") ?? undefined;
    try {
      await invoke("log_weight_activity", {
        weightLbs: weight,
        notes: notes?.trim() || undefined,
      });
      refetch();
    } catch (e) {
      console.error("log weight failed", e);
      alert(`Failed to log weight: ${e}`);
    }
  };

  return (
    <div class="p-8 space-y-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Analytics</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Trends and breakdowns aggregated from logged activities.
          </p>
        </div>
        <Button onClick={handleLogWeight}>Log weight</Button>
      </header>

      <Show when={analytics.loading && !analytics.latest}>
        <div class="text-sm text-muted-foreground">Loading…</div>
      </Show>

      <Show when={analytics.error}>
        <div class="text-sm text-destructive">
          Failed to load analytics: {String(analytics.error)}
        </div>
      </Show>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Current weight"
          value={fmtWeight(currentWeight())}
          detail={
            weightDelta() == null
              ? "No logged weight yet"
              : `${fmtSigned(weightDelta()!)} since first log`
          }
          link={latestWeightActivity() ? `/activity/${latestWeightActivity()}` : undefined}
        />
        <SummaryCard
          label="Weight logs"
          value={String(weightPoints().length)}
          detail="Activity-backed body metrics"
        />
        <SummaryCard
          label="Exercise trend"
          value={`${workoutTotal()} workouts`}
          detail={`${workoutMinutes()} min in the last 90 days`}
        />
        <SummaryCard
          label="Productivity"
          value={`${taskTotal()} tasks`}
          detail="Done tasks by category, last 30 days"
        />
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader class="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Weight Trend</CardTitle>
              <p class="mt-1 text-xs text-muted-foreground">
                Individual weigh-ins with a moving average. Goal markers can come next.
              </p>
            </div>
            <div class="text-xs text-muted-foreground">All logs</div>
          </CardHeader>
          <CardContent>
            <Show
              when={weightPoints().length > 0}
              fallback={
                <EmptyState text="No weight logs yet. Log a weight to start the trend." />
              }
            >
              <WeightChart
                points={lineData().points}
                average={avgData()}
                min={lineData().min}
                max={lineData().max}
              />
            </Show>
          </CardContent>
        </Card>

        <div class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exercise Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkoutBars weeks={workoutWeeks()} />
            </CardContent>
          </Card>

          <BreakdownCard
            title="Activity Mix"
            subtitle={`${activityTotal()} activities in the last 30 days`}
            items={data().activity_mix}
          />
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Weight Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <Show
              when={weightPoints().length > 0}
              fallback={<EmptyState text="Weight logs will appear here." />}
            >
              <div class="overflow-hidden rounded-md border border-border">
                <table class="w-full text-sm">
                  <thead class="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">Date</th>
                      <th class="px-3 py-2 text-left font-medium">Weight</th>
                      <th class="px-3 py-2 text-left font-medium">Body fat</th>
                      <th class="px-3 py-2 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={[...weightPoints()].reverse().slice(0, 8)}>
                      {(p) => (
                        <tr class="border-t border-border">
                          <td class="px-3 py-2">
                            <Show
                              when={p.activity_id}
                              fallback={<span>{shortDate(p.date)}</span>}
                            >
                              <A
                                href={`/activity/${p.activity_id}`}
                                class="hover:underline"
                              >
                                {shortDate(p.date)}
                              </A>
                            </Show>
                          </td>
                          <td class="px-3 py-2">{fmtWeight(p.weight_lbs)}</td>
                          <td class="px-3 py-2">
                            {p.body_fat_pct == null ? "—" : `${p.body_fat_pct}%`}
                          </td>
                          <td class="px-3 py-2 text-muted-foreground">
                            {p.notes || "—"}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </CardContent>
        </Card>

        <BreakdownCard
          title="Productivity Breakdown"
          subtitle="Completed tasks by category"
          items={data().productivity_breakdown}
        />
      </section>
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  detail: string;
  link?: string;
}) {
  return (
    <Card>
      <CardContent class="p-4">
        <div class="text-xs text-muted-foreground">{props.label}</div>
        <div class="mt-2 text-2xl font-semibold tracking-tight">{props.value}</div>
        <div class="mt-1 text-xs text-muted-foreground">
          <Show when={props.link} fallback={<span>{props.detail}</span>}>
            <A href={props.link!} class="hover:underline">
              {props.detail}
            </A>
          </Show>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState(props: { text: string }) {
  return (
    <div class="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      {props.text}
    </div>
  );
}

function WeightChart(props: {
  points: ChartPoint[];
  average: ChartPoint[];
  min: number;
  max: number;
}) {
  const yTicks = () => {
    const span = props.max - props.min;
    return [0, 0.25, 0.5, 0.75, 1].map((pct) => {
      const value = props.max - span * pct;
      const y = PAD.top + pct * (HEIGHT - PAD.top - PAD.bottom);
      return { value, y };
    });
  };
  const floor = HEIGHT - PAD.bottom;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} class="h-auto w-full">
      <rect width={WIDTH} height={HEIGHT} rx="8" class="fill-muted/20" />
      <For each={yTicks()}>
        {(tick) => (
          <>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={tick.y}
              y2={tick.y}
              class="stroke-border"
              stroke-width="1"
            />
            <text
              x="12"
              y={tick.y + 4}
              class="fill-muted-foreground text-[11px]"
            >
              {tick.value.toFixed(0)}
            </text>
          </>
        )}
      </For>
      <path d={areaPath(props.points, floor)} class="fill-chart-2/15" />
      <path
        d={linePath(props.points)}
        fill="none"
        class="stroke-chart-2"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <Show when={props.average.length > 1}>
        <path
          d={linePath(props.average)}
          fill="none"
          class="stroke-foreground/70"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </Show>
      <For each={props.points}>
        {(p) => (
          <circle
            cx={p.x}
            cy={p.y}
            r="4"
            class="fill-chart-2 stroke-background"
            stroke-width="2"
          >
            <title>
              {shortDate(p.label)} · {fmtWeight(p.value)}
            </title>
          </circle>
        )}
      </For>
      <Show when={props.points.length > 0}>
        <text
          x={PAD.left}
          y={HEIGHT - 10}
          class="fill-muted-foreground text-[11px]"
        >
          {shortDate(props.points[0].label)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 10}
          text-anchor="end"
          class="fill-muted-foreground text-[11px]"
        >
          {shortDate(props.points[props.points.length - 1].label)}
        </text>
      </Show>
    </svg>
  );
}

function WorkoutBars(props: {
  weeks: { label: string; count: number; minutes: number }[];
}) {
  const maxMinutes = () => Math.max(30, ...props.weeks.map((w) => w.minutes));
  return (
    <div class="space-y-3">
      <div class="flex h-32 items-end gap-2 rounded-md bg-muted/20 px-3 py-3">
        <For each={props.weeks}>
          {(week) => (
            <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                class="w-full rounded-t bg-chart-1/80"
                style={{
                  height: `${Math.max(6, (week.minutes / maxMinutes()) * 100)}%`,
                }}
                title={`${week.count} workouts · ${week.minutes} min`}
              />
              <div class="w-full truncate text-center text-[10px] text-muted-foreground">
                {week.label}
              </div>
            </div>
          )}
        </For>
      </div>
      <div class="text-xs text-muted-foreground">
        Bars show total workout minutes by week.
      </div>
    </div>
  );
}

function BreakdownCard(props: {
  title: string;
  subtitle: string;
  items: BreakdownItem[];
}) {
  const max = () => maxCount(props.items);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <p class="text-xs text-muted-foreground">{props.subtitle}</p>
      </CardHeader>
      <CardContent>
        <Show
          when={props.items.length > 0}
          fallback={<EmptyState text="No matching activities yet." />}
        >
          <div class="space-y-3">
            <For each={props.items}>
              {(item) => (
                <div>
                  <div class="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span>{item.label}</span>
                    <span class="text-muted-foreground">
                      {item.count}
                      <Show when={item.total_duration_min}>
                        {" "}
                        · {item.total_duration_min} min
                      </Show>
                    </span>
                  </div>
                  <div class="h-2 overflow-hidden rounded bg-muted">
                    <div
                      class="h-full rounded bg-emerald-400/80"
                      style={{ width: `${(item.count / max()) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}
