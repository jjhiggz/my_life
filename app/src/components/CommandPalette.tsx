import {
  Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { invoke } from "~/lib/telemetry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type PaletteMode = "tabs" | "activities";
export type PaletteIcon = Component<{ class?: string }>;

export type PaletteTab = {
  href: string;
  label: string;
  icon: PaletteIcon;
  end?: boolean;
};

type Activity = {
  id: string;
  name: string;
  goal: string;
  status: string;
  description: string;
  date: string;
  detail?: string;
};

type PaletteItem = {
  id: string;
  label: string;
  href: string;
  icon?: PaletteIcon | string;
  meta?: string;
  detail?: string;
};

const MODE_COPY: Record<
  PaletteMode,
  { title: string; description: string; placeholder: string }
> = {
  tabs: {
    title: "Go to tab",
    description: "Jump to a main section.",
    placeholder: "Search tabs...",
  },
  activities: {
    title: "Find activity",
    description: "Search logged activities.",
    placeholder: "Search activities...",
  },
};

function scoreItem(item: PaletteItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const haystack = [item.label, item.meta, item.detail].filter(Boolean).join(" ").toLowerCase();
  let score = 0;
  let lastIndex = -1;
  for (const ch of q) {
    const index = haystack.indexOf(ch, lastIndex + 1);
    if (index === -1) return 0;
    score += index === lastIndex + 1 ? 3 : 1;
    lastIndex = index;
  }
  if (haystack.startsWith(q)) score += 12;
  if (item.label.toLowerCase().includes(q)) score += 8;
  return score;
}

function isDbActivity(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id) || id.startsWith("yaml-");
}

async function loadActivities(): Promise<Activity[]> {
  return await invoke<Activity[]>("list_logged_activities");
}

function PaletteItemIcon(props: { icon?: PaletteIcon | string }) {
  if (typeof props.icon === "function") {
    const Icon = props.icon;
    return <Icon class="size-4" />;
  }
  return <>{props.icon ?? "•"}</>;
}

export default function CommandPalette(props: {
  mode: PaletteMode;
  open: boolean;
  tabs: PaletteTab[];
  onOpenChange: (open: boolean) => void;
  onSelect: (href: string) => void;
}) {
  let inputRef: HTMLInputElement | undefined;
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [activities] = createResource(
    () => (props.open && props.mode === "activities" ? true : false),
    async (enabled) => (enabled ? loadActivities() : []),
  );

  const items = createMemo<PaletteItem[]>(() => {
    const base =
      props.mode === "tabs"
        ? props.tabs.map((tab) => ({
            id: tab.href,
            label: tab.label,
            href: tab.href,
            icon: tab.icon,
            meta: "tab",
          }))
        : (activities.latest ?? [])
            .filter((activity) => isDbActivity(activity.id))
            .map((activity) => ({
              id: activity.id,
              label: activity.name,
              href: `/activity/${activity.id}`,
              icon: "▦",
              meta: [activity.goal, activity.status, activity.date]
                .filter(Boolean)
                .join(" · "),
              detail: activity.detail ?? activity.description,
            }));

    const q = query();
    return base
      .map((item) => ({ item, score: scoreItem(item, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map((entry) => entry.item)
      .slice(0, 12);
  });

  createEffect(() => {
    if (!props.open) return;
    setQuery("");
    setActiveIndex(0);
    queueMicrotask(() => inputRef?.focus());
  });

  createEffect(() => {
    const count = items().length;
    if (activeIndex() >= count) setActiveIndex(Math.max(0, count - 1));
  });

  const copy = () => MODE_COPY[props.mode];

  const selectItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    props.onSelect(item.href);
    props.onOpenChange(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, items().length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectItem(items()[activeIndex()]);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="top-[18%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <div class="border-b border-border px-4 py-3">
          <DialogTitle class="text-sm">{copy().title}</DialogTitle>
          <DialogDescription class="mt-1 text-xs">
            {copy().description}
          </DialogDescription>
        </div>
        <div class="border-b border-border p-3">
          <Input
            ref={inputRef}
            value={query()}
            placeholder={copy().placeholder}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            class="h-10 border-0 bg-muted/40 shadow-none focus-visible:ring-0"
          />
        </div>
        <div class="max-h-[420px] overflow-auto p-2">
          <Show when={activities.loading && props.mode === "activities"}>
            <div class="px-3 py-8 text-center text-sm text-muted-foreground">
              Loading activities...
            </div>
          </Show>
          <Show
            when={!activities.loading || props.mode === "tabs"}
            fallback={null}
          >
            <Show
              when={items().length > 0}
              fallback={
                <div class="px-3 py-8 text-center text-sm text-muted-foreground">
                  No matches.
                </div>
              }
            >
              <For each={items()}>
                {(item, index) => (
                  <button
                    type="button"
                    class={cn(
                      "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                      index() === activeIndex()
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                    onMouseEnter={() => setActiveIndex(index())}
                    onClick={() => selectItem(item)}
                  >
                    <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      <PaletteItemIcon icon={item.icon} />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium">{item.label}</span>
                      <Show when={item.detail}>
                        <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      </Show>
                    </span>
                    <Show when={item.meta}>
                      <Badge variant="outline" class="shrink-0 border-border text-[10px]">
                        {item.meta}
                      </Badge>
                    </Show>
                  </button>
                )}
              </For>
            </Show>
          </Show>
        </div>
        <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ select · enter open</span>
          <span>{props.mode === "tabs" ? "⌘P" : "⌘K"}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
