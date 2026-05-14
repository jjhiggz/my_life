import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";

type CalendarEvent = {
  activity_id: string;
  title: string;
  notes?: string;
  starts_at: string;
  ends_at?: string;
  all_day: boolean;
  location?: string;
  status: string;
};

type ViewMode = "day" | "week" | "month";

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const HOUR_HEIGHT = 88;
const MINUTE_HEIGHT = HOUR_HEIGHT / 60;
const DEFAULT_EVENT_MINUTES = 60;
const MIN_WEEK_DAY_WIDTH = 150;
const TIME_COL_WIDTH = 68;
const EVENT_COLOR_COUNT = 5;

function today(): Date {
  return new Date(new Date().toLocaleDateString("en-CA") + "T00:00:00");
}

function localIso(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function isSameDay(a: Date, b: Date): boolean {
  return localIso(a) === localIso(b);
}

function dateFromIso(value: string): Date {
  return new Date(value + "T00:00:00");
}

function parseEventDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthGridStart(date: Date): Date {
  return startOfWeek(startOfMonth(date));
}

function monthGridDays(anchor: Date): Date[] {
  const start = monthGridStart(anchor);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function eventDayKey(event: CalendarEvent): string {
  if (event.all_day) return event.starts_at.slice(0, 10);
  return localIso(parseEventDate(event.starts_at));
}

function eventStartMinutes(event: CalendarEvent): number {
  if (event.all_day) return 0;
  const start = parseEventDate(event.starts_at);
  return start.getHours() * 60 + start.getMinutes();
}

function eventDurationMinutes(event: CalendarEvent): number {
  if (event.all_day || !event.ends_at) return DEFAULT_EVENT_MINUTES;
  const start = parseEventDate(event.starts_at).getTime();
  const end = parseEventDate(event.ends_at).getTime();
  return Math.max(30, Math.round((end - start) / 60000));
}

function formatHour(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(d);
}

function formatDayName(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
}

function formatDayHeader(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWeekTitle(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt.format(start)} - ${endFmt.format(end)}`;
}

function formatTime(event: CalendarEvent): string {
  if (event.all_day) return "all-day";
  const start = parseEventDate(event.starts_at);
  const startText = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  if (!event.ends_at) return startText;
  const end = parseEventDate(event.ends_at);
  const endText = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  return `${startText} - ${endText}`;
}

function eventColorIndex(event: CalendarEvent): number {
  const seed = event.activity_id || event.title;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return (hash % EVENT_COLOR_COUNT) + 1;
}

function eventColorStyle(event: CalendarEvent): Record<string, string> {
  const color = `var(--chart-${eventColorIndex(event)})`;
  return {
    "--event-color": `hsl(${color})`,
    "--event-bg": `hsl(${color} / 0.18)`,
    "--event-bg-strong": `hsl(${color} / 0.28)`,
    "--event-border": `hsl(${color} / 0.48)`,
    "--event-shadow": `hsl(${color} / 0.16)`,
  };
}

function getRange(view: ViewMode, anchorIso: string): { start: Date; end: Date } {
  const anchor = dateFromIso(anchorIso);
  if (view === "day") return { start: anchor, end: anchor };
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  const start = monthGridStart(anchor);
  return { start, end: addDays(start, 41) };
}

function shiftAnchor(view: ViewMode, anchorIso: string, direction: -1 | 1): string {
  const anchor = dateFromIso(anchorIso);
  if (view === "day") return localIso(addDays(anchor, direction));
  if (view === "week") return localIso(addDays(anchor, direction * 7));
  return localIso(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
}

async function loadEvents(source: {
  view: ViewMode;
  anchorIso: string;
}): Promise<CalendarEvent[]> {
  const range = getRange(source.view, source.anchorIso);
  return await invoke<CalendarEvent[]>("list_calendar_events", {
    fromDate: localIso(range.start),
    toDate: localIso(range.end),
  });
}

export default function Calendar() {
  const [view, setView] = createSignal<ViewMode>("week");
  const [anchorIso, setAnchorIso] = createSignal(localIso(today()));
  const [events] = createResource(
    () => ({ view: view(), anchorIso: anchorIso() }),
    loadEvents,
  );

  const anchor = () => dateFromIso(anchorIso());
  const range = () => getRange(view(), anchorIso());
  const allEvents = () => events.latest ?? [];
  const daysInWeek = () => {
    const start = startOfWeek(anchor());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };
  const daysInMonthGrid = () => monthGridDays(anchor());

  const title = () => {
    if (view() === "day") return formatFullDate(anchor());
    if (view() === "week") return formatWeekTitle(range().start, range().end);
    return formatMonthTitle(anchor());
  };
  const subtitle = () => {
    if (view() === "day") return formatDayName(anchor());
    if (view() === "week") return `${allEvents().length} events`;
    return `${allEvents().length} events this month view`;
  };

  const eventsForDay = (date: Date) => {
    const key = localIso(date);
    return allEvents().filter((event) => eventDayKey(event) === key);
  };
  const allDayEventsForDay = (date: Date) =>
    eventsForDay(date).filter((event) => event.all_day);
  const timedEventsForDay = (date: Date) =>
    eventsForDay(date).filter((event) => !event.all_day);

  const eventStyle = (event: CalendarEvent) => {
    const visibleStart = HOURS[0] * 60;
    const visibleEnd = (HOURS[HOURS.length - 1] + 1) * 60;
    const start = eventStartMinutes(event);
    const top = Math.max(0, start - visibleStart);
    const bottom = start + eventDurationMinutes(event);
    const duration = Math.max(
      30,
      Math.min(bottom, visibleEnd) - Math.max(start, visibleStart),
    );
    return {
      top: `${top * MINUTE_HEIGHT}px`,
      height: `${duration * MINUTE_HEIGHT}px`,
    };
  };

  const moveRange = (direction: -1 | 1) =>
    setAnchorIso((current) => shiftAnchor(view(), current, direction));
  const jumpToday = () => setAnchorIso(localIso(today()));

  return (
    <div class="flex min-h-full min-w-0 max-w-full flex-col overflow-hidden bg-background">
      <header class="flex min-w-0 flex-col gap-4 border-b border-border bg-gradient-to-r from-primary/10 via-chart-2/10 to-chart-3/10 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-4xl font-semibold tracking-tight">{title()}</h1>
          <div class="mt-1 text-lg text-muted-foreground">{subtitle()}</div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <div class="inline-flex rounded-full border border-border bg-card p-1">
            <For each={VIEWS}>
              {(item) => (
                <Button
                  variant={view() === item.key ? "default" : "ghost"}
                  size="sm"
                  class="rounded-full"
                  onClick={() => setView(item.key)}
                >
                  {item.label}
                </Button>
              )}
            </For>
          </div>
          <div class="inline-flex rounded-full border border-border bg-card p-1">
            <Button variant="ghost" size="sm" class="rounded-full" onClick={() => moveRange(-1)}>
              Prev
            </Button>
            <Button variant="ghost" size="sm" class="rounded-full" onClick={jumpToday}>
              Today
            </Button>
            <Button variant="ghost" size="sm" class="rounded-full" onClick={() => moveRange(1)}>
              Next
            </Button>
          </div>
        </div>
      </header>

      <Show when={events.error}>
        <div class="mx-6 mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load calendar events: {String(events.error)}
        </div>
      </Show>

      <Show when={view() === "day"}>
        <DayView
          day={anchor()}
          allDayEvents={allDayEventsForDay(anchor())}
          timedEvents={timedEventsForDay(anchor())}
          eventStyle={eventStyle}
        />
      </Show>

      <Show when={view() === "week"}>
        <WeekView
          days={daysInWeek()}
          allDayEventsForDay={allDayEventsForDay}
          timedEventsForDay={timedEventsForDay}
          eventStyle={eventStyle}
        />
      </Show>

      <Show when={view() === "month"}>
        <MonthView
          anchor={anchor()}
          days={daysInMonthGrid()}
          eventsForDay={eventsForDay}
        />
      </Show>
    </div>
  );
}

function DayView(props: {
  day: Date;
  allDayEvents: CalendarEvent[];
  timedEvents: CalendarEvent[];
  eventStyle: (event: CalendarEvent) => Record<string, string>;
}) {
  return (
    <div class="min-w-0 flex-1 overflow-auto">
      <div class="border-b border-border bg-gradient-to-r from-primary/10 via-chart-2/10 to-transparent">
        <div class="grid" style={{ "grid-template-columns": `${TIME_COL_WIDTH}px 1fr` }}>
          <div class="border-r border-border px-4 py-3 text-xs font-medium text-muted-foreground">
            all-day
          </div>
          <div class="min-h-12 p-2">
            <For each={props.allDayEvents}>
              {(event) => <EventChip event={event} compact />}
            </For>
          </div>
        </div>
      </div>

      <div
        class="grid"
        style={{
          "grid-template-columns": `${TIME_COL_WIDTH}px 1fr`,
          height: `${HOURS.length * HOUR_HEIGHT}px`,
        }}
      >
        <TimeColumn />
        <div class="relative">
          <HourLines />
          <For each={props.timedEvents}>
            {(event) => (
              <TimedEvent event={event} style={props.eventStyle(event)} />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function WeekView(props: {
  days: Date[];
  allDayEventsForDay: (date: Date) => CalendarEvent[];
  timedEventsForDay: (date: Date) => CalendarEvent[];
  eventStyle: (event: CalendarEvent) => Record<string, string>;
}) {
  const gridTemplate = `${TIME_COL_WIDTH}px repeat(7, minmax(${MIN_WEEK_DAY_WIDTH}px, 1fr))`;
  const minGridWidth = `${TIME_COL_WIDTH + MIN_WEEK_DAY_WIDTH * 7}px`;
  return (
    <div class="min-w-0 flex-1 overflow-auto">
      <div class="w-full" style={{ "min-width": minGridWidth }}>
        <div class="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div class="grid" style={{ "grid-template-columns": gridTemplate }}>
            <div class="border-r border-border" />
            <For each={props.days}>
              {(day) => (
                <div
                  class="border-r border-border px-4 py-3 text-center last:border-r-0"
                  classList={{
                    "bg-primary/10": isSameDay(day, today()),
                  }}
                >
                  <div class="text-sm text-muted-foreground">
                    {formatDayHeader(day).split(",")[0]}
                  </div>
                  <div
                    class="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold"
                    classList={{
                      "bg-primary text-primary-foreground": isSameDay(day, today()),
                    }}
                  >
                    {new Intl.DateTimeFormat(undefined, {
                      month: "numeric",
                      day: "numeric",
                    }).format(day)}
                  </div>
                </div>
              )}
            </For>
          </div>
          <div
            class="grid bg-gradient-to-r from-muted/20 via-chart-2/10 to-chart-3/10"
            style={{ "grid-template-columns": gridTemplate }}
          >
            <div class="border-r border-border px-3 py-3 text-xs font-medium text-muted-foreground">
              all-day
            </div>
            <For each={props.days}>
              {(day) => (
                <div class="min-h-12 border-r border-border p-2 last:border-r-0">
                  <For each={props.allDayEventsForDay(day)}>
                    {(event) => <EventChip event={event} compact />}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>

        <div
          class="grid"
          style={{
            "grid-template-columns": gridTemplate,
            height: `${HOURS.length * HOUR_HEIGHT}px`,
          }}
        >
          <TimeColumn />
          <For each={props.days}>
            {(day) => (
              <div
                class="relative border-r border-border last:border-r-0"
                classList={{
                  "bg-primary/5": isSameDay(day, today()),
                }}
              >
                <HourLines />
                <For each={props.timedEventsForDay(day)}>
                  {(event) => (
                    <TimedEvent event={event} style={props.eventStyle(event)} />
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function MonthView(props: {
  anchor: Date;
  days: Date[];
  eventsForDay: (date: Date) => CalendarEvent[];
}) {
  const month = props.anchor.getMonth();
  const todayKey = localIso(today());
  return (
    <div class="min-w-0 flex-1 overflow-auto p-6">
      <div class="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-border">
        <For each={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}>
          {(day) => (
            <div class="border-b border-r border-border bg-gradient-to-r from-primary/10 to-chart-2/10 px-3 py-2 text-right text-sm font-medium text-muted-foreground">
              {day}
            </div>
          )}
        </For>
        <For each={props.days}>
          {(day) => {
            const key = localIso(day);
            const inMonth = day.getMonth() === month;
            const dayEvents = createMemo(() => props.eventsForDay(day));
            return (
              <div
                class="min-h-36 border-b border-r border-border p-2 transition-colors"
                classList={{
                  "bg-muted/10": inMonth,
                  "bg-muted/5 text-muted-foreground/60": !inMonth,
                  "bg-primary/5": key === todayKey,
                }}
              >
                <div
                  class="mb-2 ml-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium"
                  classList={{
                    "bg-primary text-primary-foreground": key === todayKey,
                  }}
                >
                  {day.getDate()}
                </div>
                <div
                  class="space-y-1 rounded-md"
                  classList={{
                    "border-t border-primary/20 pt-1": dayEvents().length > 0,
                  }}
                >
                  <For each={dayEvents().slice(0, 4)}>
                    {(event) => <EventChip event={event} compact />}
                  </For>
                  <Show when={dayEvents().length > 4}>
                    <div class="px-2 text-xs text-muted-foreground">
                      +{dayEvents().length - 4} more
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

function TimeColumn() {
  return (
    <div class="relative border-r border-border bg-muted/10">
      <For each={HOURS}>
        {(hour, index) => (
          <div
            class="absolute right-2 -translate-y-2 text-xs font-medium text-muted-foreground"
            style={{ top: `${index() * HOUR_HEIGHT}px` }}
          >
            {formatHour(hour)}
          </div>
        )}
      </For>
    </div>
  );
}

function HourLines() {
  return (
    <For each={HOURS}>
      {(_, index) => (
        <div
          class="absolute left-0 right-0 border-t border-border/80"
          style={{ top: `${index() * HOUR_HEIGHT}px` }}
        />
      )}
    </For>
  );
}

function EventChip(props: { event: CalendarEvent; compact?: boolean }) {
  return (
    <div
      class="truncate rounded-md border px-2 py-1 text-xs font-medium shadow-sm"
      style={{
        ...eventColorStyle(props.event),
        "background-color": "var(--event-bg)",
        "border-color": "var(--event-border)",
        color: "var(--event-color)",
        "box-shadow": "0 1px 8px var(--event-shadow)",
      }}
      title={props.event.title}
    >
      <Show when={!props.event.all_day && !props.compact}>
        <span class="mr-1 opacity-75">{formatTime(props.event)}</span>
      </Show>
      {props.event.title}
    </div>
  );
}

function TimedEvent(props: {
  event: CalendarEvent;
  style: Record<string, string>;
}) {
  return (
    <div
      class="absolute left-1 right-1 overflow-hidden rounded-md border border-l-4 px-2 py-1.5 text-xs shadow-sm"
      style={{
        ...props.style,
        ...eventColorStyle(props.event),
        "background-color": "var(--event-bg-strong)",
        "border-color": "var(--event-border)",
        "border-left-color": "var(--event-color)",
        color: "var(--event-color)",
        "box-shadow": "0 4px 14px var(--event-shadow)",
      }}
      title={`${props.event.title} · ${formatTime(props.event)}`}
    >
      <div class="truncate font-medium">{props.event.title}</div>
      <div class="truncate opacity-75">{formatTime(props.event)}</div>
      <Show when={props.event.location}>
        <div class="truncate opacity-65">{props.event.location}</div>
      </Show>
    </div>
  );
}
