import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { marked } from "marked";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import LogStrengthDialog, {
  type StrengthPrefill,
} from "~/components/LogStrengthDialog";

type PlanExercise = {
  name: string;
  sets?: number;
  reps?: string | number;
  duration?: string;
  note?: string;
};

type PlanWorkout = {
  type?: string;
  focus?: string;
  duration_min?: number;
  modality?: string;
  exercises?: PlanExercise[];
};

type PlanFrontmatter = {
  date?: string;
  day?: string;
  energy_level?: string;
  adjustments?: string;
  workout?: PlanWorkout;
};

type DailyPlan = {
  date: string;
  frontmatter: PlanFrontmatter;
  body_markdown: string;
  file_exists: boolean;
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function fmtDate(date: string): string {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  if (date === tomorrow) return "Tomorrow";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const ENERGY_TONE: Record<string, string> = {
  high: "bg-green-500/15 text-green-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-orange-500/15 text-orange-400",
};

marked.setOptions({
  gfm: true,
  breaks: false,
});

function renderMarkdown(src: string): string {
  return marked.parse(src) as string;
}

export default function Plans() {
  const [viewDate, setViewDate] = createSignal(todayIso());
  const [showStrength, setShowStrength] = createSignal(false);

  const [plan, { refetch }] = createResource(viewDate, (d) =>
    invoke<DailyPlan>("list_plan_for_date", { date: d }),
  );
  const [knownDates] = createResource(() =>
    invoke<string[]>("list_plan_dates"),
  );

  const fm = () => plan()?.frontmatter;
  const workoutPrefill = createMemo<StrengthPrefill | null>(() => {
    const w = fm()?.workout;
    if (!w || w.type !== "strength" || !w.exercises?.length) return null;
    return {
      title: w.focus ?? undefined,
      durationMin: w.duration_min ?? undefined,
      exercises: w.exercises.map((e) => ({
        name: e.name,
        kind: e.duration ? "timed" : "strength",
        setCount: e.sets ?? 1,
      })),
    };
  });

  const renderedBody = () => renderMarkdown(plan()?.body_markdown ?? "");

  const isToday = () => viewDate() === todayIso();

  return (
    <div class="p-8 space-y-6 max-w-4xl">
      <header class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold tracking-tight">Plans</h1>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewDate(addDays(viewDate(), -1))}
          >
            ←
          </Button>
          <span class="font-medium min-w-[140px] text-center text-sm">
            {fmtDate(viewDate())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewDate(addDays(viewDate(), 1))}
          >
            →
          </Button>
          <Show when={!isToday()}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewDate(todayIso())}
            >
              Today
            </Button>
          </Show>
        </div>
      </header>

      <Show when={plan.loading && !plan.latest}>
        <div class="text-sm text-muted-foreground">Loading…</div>
      </Show>

      <Show when={plan() && !plan()!.file_exists}>
        <Card class="border-dashed">
          <CardContent class="pt-6 space-y-3 text-center">
            <div class="text-sm text-muted-foreground">
              No plan for {fmtDate(viewDate())} yet.
            </div>
            <div class="text-xs text-muted-foreground">
              Generate one by running{" "}
              <code class="rounded bg-muted px-1.5 py-0.5">/today</code> in the
              Agent tab.
            </div>
            <Show when={(knownDates() ?? []).length > 0}>
              <div class="pt-2">
                <div class="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Recent plans
                </div>
                <div class="flex flex-wrap justify-center gap-1">
                  <For each={(knownDates() ?? []).slice(0, 8)}>
                    {(d) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewDate(d)}
                      >
                        {d}
                      </Button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </CardContent>
        </Card>
      </Show>

      <Show when={plan() && plan()!.file_exists}>
        {/* Top status strip */}
        <Show when={fm()}>
          <div class="rounded-lg border border-border bg-card/40 p-4 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <Show when={fm()!.energy_level}>
                <Badge
                  class={
                    ENERGY_TONE[fm()!.energy_level!] ??
                    "bg-muted text-muted-foreground"
                  }
                >
                  {fm()!.energy_level} energy
                </Badge>
              </Show>
              <Show when={fm()!.workout?.type}>
                <Badge variant="outline">{fm()!.workout!.type}</Badge>
              </Show>
              <Show when={fm()!.workout?.focus}>
                <span class="text-sm text-muted-foreground">
                  {fm()!.workout!.focus}
                </span>
              </Show>
              <Show when={fm()!.workout?.duration_min}>
                <span class="text-sm text-muted-foreground">
                  · {fm()!.workout!.duration_min} min
                </span>
              </Show>
              <Show when={workoutPrefill()}>
                <Button
                  size="sm"
                  class="ml-auto"
                  onClick={() => setShowStrength(true)}
                >
                  Start workout →
                </Button>
              </Show>
            </div>
            <Show when={fm()!.adjustments}>
              <div class="text-sm italic text-muted-foreground">
                {fm()!.adjustments}
              </div>
            </Show>
          </div>
        </Show>

        {/* Markdown body */}
        <div
          class="plan-body prose prose-invert max-w-none"
          innerHTML={renderedBody()}
        />
      </Show>

      <LogStrengthDialog
        open={showStrength()}
        prefill={workoutPrefill()}
        onClose={() => setShowStrength(false)}
        onLogged={() => {
          refetch();
        }}
      />
    </div>
  );
}
