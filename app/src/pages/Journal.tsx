import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { marked } from "marked";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import TerminalView from "~/Terminal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type Interval = "daily" | "weekly" | "monthly";

type JournalEntry = {
  interval: Interval;
  key: string;
  title: string;
  path: string;
  exists: boolean;
  markdown: string;
};

type JournalSummary = {
  interval: Interval;
  key: string;
  title: string;
  path: string;
  exists: boolean;
  updated_at?: string;
};

const INTERVALS: { key: Interval; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(key: string, days: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function addWeeks(key: string, weeks: number): string {
  const [year, weekRaw] = key.split("-W");
  const week = Number(weekRaw);
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1 + weeks) * 7);
  return isoWeekKey(monday);
}

function monthKey(): string {
  return todayKey().slice(0, 7);
}

function addMonths(key: string, months: number): string {
  const d = new Date(key + "-01T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-CA").slice(0, 7);
}

function keyFor(interval: Interval): string {
  if (interval === "daily") return todayKey();
  if (interval === "weekly") return isoWeekKey();
  return monthKey();
}

function shiftKey(interval: Interval, key: string, delta: number): string {
  if (interval === "daily") return addDays(key, delta);
  if (interval === "weekly") return addWeeks(key, delta);
  return addMonths(key, delta);
}

function formatKey(interval: Interval, key: string): string {
  if (interval === "daily") {
    return new Date(key + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (interval === "weekly") return `Week ${key}`;
  return new Date(key + "-01T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatUpdated(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Journal() {
  const [interval, setInterval] = createSignal<Interval>("daily");
  const [key, setKey] = createSignal(keyFor("daily"));
  const [refreshTick, setRefreshTick] = createSignal(0);
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editorSession, setEditorSession] = createSignal<{
    interval: Interval;
    key: string;
    id: number;
  } | null>(null);

  const entryKey = createMemo(() => ({
    interval: interval(),
    key: key(),
    refresh: refreshTick(),
  }));

  const [entry] = createResource(entryKey, async (params) =>
    invoke<JournalEntry>("read_journal_entry", {
      interval: params.interval,
      key: params.key,
    }),
  );

  const [entries] = createResource(
    () => ({ interval: interval(), refresh: refreshTick() }),
    async (params) =>
      invoke<JournalSummary[]>("list_journal_entries", {
        interval: params.interval,
      }),
  );

  const rendered = () => {
    const markdown = entry()?.markdown ?? "";
    return markdown.trim() ? (marked.parse(markdown) as string) : "";
  };

  const switchInterval = (next: Interval) => {
    setInterval(next);
    setKey(keyFor(next));
  };

  const openInEditor = async () => {
    setEditorOpen(true);
    setEditorSession({
      interval: interval(),
      key: key(),
      id: Date.now(),
    });
    setRefreshTick((tick) => tick + 1);
  };

  onMount(async () => {
    let unlistenExit: UnlistenFn | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.metaKey && !event.altKey && event.code === "KeyO") {
        event.preventDefault();
        openInEditor();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    unlistenExit = await listen("journal-editor-pty-exit", () => {
      setEditorOpen(false);
      setEditorSession(null);
      setRefreshTick((tick) => tick + 1);
    });
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
      unlistenExit?.();
    });
  });

  return (
    <div class="p-8 space-y-6">
      <header class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Journal</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Daily, weekly, and monthly reflections as markdown.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-md border border-border bg-card p-1">
            <For each={INTERVALS}>
              {(item) => (
                <Button
                  variant={interval() === item.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => switchInterval(item.key)}
                >
                  {item.label}
                </Button>
              )}
            </For>
          </div>
          <Button variant="outline" onClick={() => setKey(shiftKey(interval(), key(), -1))}>
            ←
          </Button>
          <Button variant="outline" onClick={() => setKey(keyFor(interval()))}>
            Current
          </Button>
          <Button variant="outline" onClick={() => setKey(shiftKey(interval(), key(), 1))}>
            →
          </Button>
          <Button onClick={openInEditor}>
            {editorOpen() ? "Restart Neovim" : "Open in Neovim"}
          </Button>
          <Show when={editorOpen()}>
            <Button
              variant="outline"
              onClick={() => {
                setEditorOpen(false);
                setRefreshTick((tick) => tick + 1);
              }}
            >
              Preview
            </Button>
          </Show>
        </div>
      </header>

      <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{formatKey(interval(), key())}</CardTitle>
                <p class="mt-1 text-xs text-muted-foreground">
                  {entry()?.exists
                    ? entry()?.path
                    : "This entry will be created when you open it."}
                </p>
              </div>
              <Show when={entry() && !entry()!.exists}>
                <span class="rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                  draft template
                </span>
              </Show>
            </div>
          </CardHeader>
          <CardContent>
            <Show
              when={editorOpen() && editorSession()}
              fallback={
                <Show
                  when={!entry.loading}
                  fallback={<div class="text-sm text-muted-foreground">Loading…</div>}
                >
                  <Show
                    when={rendered()}
                    fallback={
                      <div class="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                        No journal content yet.
                      </div>
                    }
                  >
                    <div class="plan-body" innerHTML={rendered()} />
                  </Show>
                </Show>
              }
            >
              {(session) => (
                <div class="-m-6 h-[calc(100vh-15rem)] min-h-[620px] overflow-hidden bg-black">
                  <TerminalView
                    key={session().id}
                    outputEvent="journal-editor-pty-output"
                    openCommand="journal_editor_pty_open"
                    writeCommand="journal_editor_pty_write"
                    resizeCommand="journal_editor_pty_resize"
                    openArgs={{
                      interval: session().interval,
                      key: session().key,
                    }}
                  />
                </div>
              )}
            </Show>
          </CardContent>
        </Card>

        <aside class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <Show
                when={(entries.latest ?? []).length > 0}
                fallback={
                  <div class="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    No saved {interval()} entries yet.
                  </div>
                }
              >
                <div class="space-y-1">
                  <For each={entries.latest ?? []}>
                    {(summary) => (
                      <button
                        type="button"
                        class={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          summary.key === key()
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => setKey(summary.key)}
                      >
                        <span class="block font-medium">{summary.key}</span>
                        <Show when={summary.updated_at}>
                          <span class="text-xs text-muted-foreground">
                            {formatUpdated(summary.updated_at)}
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </CardContent>
          </Card>
        </aside>
      </section>

    </div>
  );
}
