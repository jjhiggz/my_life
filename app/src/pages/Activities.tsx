import { createResource, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Status = "available" | "in_progress" | "done";

type Activity = {
  id: string;
  name: string;
  goal: string;
  status: Status;
  description: string;
  date: string;
  detail?: string;
};

const GOAL_META: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  fitness: { icon: "▲", color: "text-red-400 bg-red-500/15", label: "fitness" },
  gardening: {
    icon: "❀",
    color: "text-green-400 bg-green-500/15",
    label: "gardening",
  },
  skills: {
    icon: "♪",
    color: "text-purple-400 bg-purple-500/15",
    label: "skills",
  },
  life: {
    icon: "◆",
    color: "text-orange-400 bg-orange-500/15",
    label: "life",
  },
  career: {
    icon: "✦",
    color: "text-blue-400 bg-blue-500/15",
    label: "career",
  },
};

const goalIcon = (g: string) =>
  GOAL_META[g] ?? { icon: "●", color: "text-zinc-400 bg-zinc-500/15", label: g };

/** True if the card.id is a real DB activity (UUID or yaml-import). Synthetic
 *  yaml-derived cards (tasks, quiz) carry date-prefixed slug ids — those have
 *  no underlying DB row, so we don't link to the detail page for them. */
function isDbActivity(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id) || id.startsWith("yaml-");
}

const STATUS_COLS: { key: Status; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

async function loadActivities(): Promise<Activity[]> {
  return await invoke<Activity[]>("list_logged_activities");
}

type ViewMode = "kanban" | "list";

export default function Activities() {
  const [view, setView] = createSignal<ViewMode>("kanban");
  const [goalFilter, setGoalFilter] = createSignal<string>("all");
  const [search, setSearch] = createSignal("");
  const [activities] = createResource(loadActivities);

  const all = () => activities.latest ?? [];
  const firstLoad = (): boolean => !!activities.loading && !activities.latest;

  const goals = () => {
    const set = new Set(all().map((a) => a.goal));
    return ["all", ...Array.from(set)];
  };

  const filtered = () =>
    all().filter((a) => {
      if (goalFilter() !== "all" && a.goal !== goalFilter()) return false;
      const q = search().toLowerCase().trim();
      if (
        q &&
        !a.name.toLowerCase().includes(q) &&
        !a.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });

  const byStatus = (status: Status) =>
    filtered().filter((a) => a.status === status);

  return (
    <div class="p-8 space-y-6">
      <header class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold tracking-tight">Activities</h1>
        <div class="inline-flex rounded-md border border-border bg-card p-1">
          <Button
            variant={view() === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            Kanban
          </Button>
          <Button
            variant={view() === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>
      </header>

      <div class="flex items-center gap-3">
        <Input
          type="text"
          placeholder="Search..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="max-w-sm"
        />
        <Select
          options={goals()}
          value={goalFilter()}
          onChange={(v) => setGoalFilter(v ?? "all")}
          itemComponent={(props) => (
            <SelectItem item={props.item}>
              {props.item.rawValue === "all" ? "All goals" : props.item.rawValue}
            </SelectItem>
          )}
        >
          <SelectTrigger class="w-[160px]">
            <SelectValue<string>>
              {(state) =>
                state.selectedOption() === "all"
                  ? "All goals"
                  : state.selectedOption()
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>

      <Show when={firstLoad()}>
        <div class="text-muted-foreground text-sm">Loading…</div>
      </Show>

      <Show when={activities.error}>
        <div class="text-destructive text-sm">
          Failed to load: {String(activities.error)}
        </div>
      </Show>

      <Show
        when={view() === "kanban"}
        fallback={
          <div class="space-y-2">
            <For each={filtered()}>{(a) => <ActivityRow activity={a} />}</For>
            <Show when={!firstLoad() && filtered().length === 0}>
              <div class="text-muted-foreground text-sm">
                No activities match your filters.
              </div>
            </Show>
          </div>
        }
      >
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <For each={STATUS_COLS}>
            {(col) => {
              const items = () => byStatus(col.key);
              return (
                <div class="rounded-lg border border-border bg-card/40 p-3">
                  <div class="mb-3 flex items-center justify-between px-1">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {col.label}
                    </span>
                    <Badge variant="secondary" class="text-xs">
                      {items().length}
                    </Badge>
                  </div>
                  <div class="space-y-2">
                    <For each={items()}>
                      {(a) => <ActivityCard activity={a} />}
                    </For>
                    <Show when={!firstLoad() && items().length === 0}>
                      <div class="text-center text-sm text-muted-foreground py-6">
                        —
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}

function GoalIcon(props: { goal: string }) {
  const meta = goalIcon(props.goal);
  return (
    <span
      class={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs ${meta.color}`}
      title={meta.label}
    >
      {meta.icon}
    </span>
  );
}

function ActivityCard(props: { activity: Activity }) {
  const a = props.activity;
  const linkable = isDbActivity(a.id);
  return (
    <Card class="hover:bg-accent/30 transition-colors">
      <CardHeader class="flex-row items-start gap-2 space-y-0 p-3 pb-2">
        <GoalIcon goal={a.goal} />
        <CardTitle class="text-sm leading-tight">
          <Show when={linkable} fallback={<span>{a.name}</span>}>
            <A
              href={`/activity/${a.id}`}
              class="hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {a.name}
            </A>
          </Show>
        </CardTitle>
      </CardHeader>
      <CardContent class="p-3 pt-0 pl-11 space-y-1">
        <Show when={a.description}>
          <div class="text-xs text-foreground/80">{a.description}</div>
        </Show>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Show when={a.detail}>
            <span>{a.detail}</span>
            <span aria-hidden>·</span>
          </Show>
          <span>{a.date}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow(props: { activity: Activity }) {
  const a = props.activity;
  const linkable = isDbActivity(a.id);
  return (
    <Card class="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors">
      <GoalIcon goal={a.goal} />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">
          <Show when={linkable} fallback={<span>{a.name}</span>}>
            <A href={`/activity/${a.id}`} class="hover:underline">
              {a.name}
            </A>
          </Show>
        </div>
        <Show when={a.description}>
          <div class="truncate text-xs text-muted-foreground">
            {a.description}
          </div>
        </Show>
      </div>
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" class="capitalize">
          {a.status.replace("_", " ")}
        </Badge>
        <Show when={a.detail}>
          <span>{a.detail}</span>
        </Show>
        <span>{a.date}</span>
      </div>
    </Card>
  );
}
