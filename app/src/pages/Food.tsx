import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  onCleanup,
  onMount,
} from "solid-js";
import { invoke } from "~/lib/telemetry";
import { useNavigate } from "@solidjs/router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import QuickAddDialog from "~/components/QuickAddDialog";
import EditItemDialog, { type EditableItem } from "~/components/EditItemDialog";
import FoodInsightsBar from "~/components/FoodInsightsBar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type MealItem = {
  id: string;
  food_name: string;
  serving_size?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  quantity?: number;
  food_id?: string;
  serving_id?: string;
};

type Meal = {
  activity_id: string;
  meal_type: string;
  created_at: string;
  total_calories?: number;
  total_protein_g?: number;
  items: MealItem[];
};

type DailyTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calorie_target: number;
  protein_target_g: number;
};

type DayFood = {
  date: string;
  totals: DailyTotals;
  meals: Meal[];
};

type Serving = {
  id: string;
  label: string;
  calories?: number;
  protein_g?: number;
};

type FoodRow = {
  id: string;
  display_name: string;
  use_count: number;
  default_serving?: Serving;
};

type TemplateItem = {
  food_id: string;
  food_name: string;
  serving_id?: string;
  serving_label?: string;
  quantity: number;
  calories?: number;
  protein_g?: number;
};

type MealTemplate = {
  id: string;
  name: string;
  use_count: number;
  total_calories: number;
  total_protein_g: number;
  items: TemplateItem[];
};

type DaySummary = {
  date: string;
  calories: number;
  protein_g: number;
  meal_count: number;
};


type DeletedItem = {
  id: string;
  meal_id: string;
  food_name: string;
  serving_size?: string;
  calories?: number;
  protein_g?: number;
  quantity?: number;
};

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
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

function fmtDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  const today = todayIso();
  const yesterday = addDays(today, -1);
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function startOfWeek(date: string): string {
  // Sunday-start week. To start on Monday, change +1 to -0 etc.
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toLocaleDateString("en-CA");
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

function fmtWeekday(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function fmtDayNum(date: string): string {
  const d = new Date(date + "T00:00:00");
  return String(d.getDate());
}

function sortMealsByTime(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

type ViewMode = "day" | "week" | "month";

const BOOST_CAL = 300;
const BOOST_PROTEIN = 30;

function isBoostedDay(date: string): boolean {
  try {
    return localStorage.getItem(`boost:${date}`) === "1";
  } catch {
    return false;
  }
}

function setBoostedDay(date: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(`boost:${date}`, "1");
    else localStorage.removeItem(`boost:${date}`);
  } catch {}
}

export default function Food() {
  const navigate = useNavigate();
  const [view, setView] = createSignal<ViewMode>("day");
  const [viewDate, setViewDate] = createSignal<string>(todayIso());

  const [today, { refetch: refetchToday }] = createResource(
    viewDate,
    (date) => invoke<DayFood>("list_food_for_date", { date }),
  );
  const [week, { refetch: refetchWeek }] = createResource(
    () => (view() === "week" ? startOfWeek(viewDate()) : null),
    async (start) => {
      if (!start) return [] as DaySummary[];
      return invoke<DaySummary[]>("list_food_week", { startDate: start });
    },
  );
  const [month, { refetch: refetchMonth }] = createResource(
    () => {
      if (view() !== "month") return null;
      const d = new Date(viewDate() + "T00:00:00");
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    },
    async (ym) => {
      if (!ym) return [] as DaySummary[];
      return invoke<DaySummary[]>("list_food_month", {
        year: ym.year,
        month: ym.month,
      });
    },
  );
  const [recent, { refetch: refetchRecent }] = createResource(() =>
    invoke<FoodRow[]>("list_foods", { order: "recent", limit: 3 }),
  );
  const [frequent, { refetch: refetchFrequent }] = createResource(() =>
    invoke<FoodRow[]>("list_foods", { order: "frequent", limit: 3 }),
  );
  const [templates, { refetch: refetchTemplates }] = createResource(() =>
    invoke<MealTemplate[]>("list_meal_templates"),
  );
  const [search, setSearch] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<FoodRow[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [pickerFood, setPickerFood] = createSignal<FoodRow | null>(null);
  const [undoItem, setUndoItem] = createSignal<DeletedItem | null>(null);
  const [editingItem, setEditingItem] = createSignal<EditableItem | null>(null);
  const [expandedMeals, setExpandedMeals] = createSignal<Set<string>>(new Set());
  const toggleMeal = (mealId: string) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  };
  const isExpanded = (mealId: string) => expandedMeals().has(mealId);
  const [boostTick, setBoostTick] = createSignal(0);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  const boosted = () => {
    boostTick(); // depend on tick so it re-runs after toggle
    return isBoostedDay(viewDate());
  };

  const toggleBoost = () => {
    setBoostedDay(viewDate(), !boosted());
    setBoostTick((t) => t + 1);
  };

  const effectiveCalTarget = () => {
    const base = dayData()?.totals.calorie_target ?? 2200;
    return base + (boosted() ? BOOST_CAL : 0);
  };
  const effectiveProteinTarget = () => {
    const base = dayData()?.totals.protein_target_g ?? 150;
    return base + (boosted() ? BOOST_PROTEIN : 0);
  };

  const isToday = () => viewDate() === todayIso();

  // Stale-while-revalidate accessors — return last good value during refetches.
  // Use createMemo with a "remember last" pattern so we don't depend on
  // resource.latest (which can be flaky across solid versions / source-changes).
  const dayData = createMemo<DayFood | undefined>((prev) => today() ?? prev);
  const weekData = createMemo<DaySummary[] | undefined>((prev) => week() ?? prev);
  const monthData = createMemo<DaySummary[] | undefined>(
    (prev) => month() ?? prev,
  );
  const recentList = createMemo<FoodRow[]>((prev) => recent() ?? prev ?? [], []);
  const frequentList = createMemo<FoodRow[]>(
    (prev) => frequent() ?? prev ?? [],
    [],
  );
  const templateList = createMemo<MealTemplate[]>(
    (prev) => templates() ?? prev ?? [],
    [],
  );

  // Only "first ever load" — once we have data, never show loading again.
  const dayFirstLoad = () => today.loading && !dayData();
  const weekFirstLoad = () => week.loading && !weekData();
  const monthFirstLoad = () => month.loading && !monthData();

  const refreshAll = () => {
    refetchToday();
    refetchRecent();
    refetchFrequent();
    refetchTemplates();
    refetchWeek();
    refetchMonth();
  };

  const armUndo = (item: DeletedItem) => {
    setUndoItem(item);
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => setUndoItem(null), 6000);
  };

  const handleUndo = async () => {
    const it = undoItem();
    if (!it) return;
    setUndoItem(null);
    if (undoTimer) clearTimeout(undoTimer);
    try {
      await invoke("restore_meal_item", {
        itemId: it.id,
        mealId: it.meal_id,
        foodId: null,
        foodName: it.food_name,
        servingId: null,
        servingSize: it.serving_size,
        calories: it.calories,
        proteinG: it.protein_g,
        carbsG: null,
        fatG: null,
        quantity: it.quantity,
      });
      refreshAll();
    } catch (e) {
      console.error("restore failed", e);
    }
  };

  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && undoItem()) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (!inField && view() === "day") {
        if (e.key === "ArrowLeft") {
          setViewDate(addDays(viewDate(), -1));
        } else if (e.key === "ArrowRight" && !isToday()) {
          setViewDate(addDays(viewDate(), 1));
        }
      }
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  // Debounced search
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const onSearchInput = (q: string) => {
    setSearch(q);
    if (searchTimer) clearTimeout(searchTimer);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await invoke<FoodRow[]>("search_foods", {
          query: q,
          limit: 15,
        });
        setSearchResults(results);
      } catch (e) {
        console.error("search failed", e);
      }
    }, 150);
  };

  const handleDelete = async (it: MealItem, mealId: string) => {
    if (busy()) return;
    setBusy(true);
    try {
      await invoke("delete_meal_item", { itemId: it.id });
      armUndo({
        id: it.id,
        meal_id: mealId,
        food_name: it.food_name,
        serving_size: it.serving_size,
        calories: it.calories,
        protein_g: it.protein_g,
        quantity: it.quantity,
      });
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const handleDescribeToAgent = async () => {
    try {
      await invoke("pty_write", { data: "I just ate " });
    } catch (e) {
      console.error("pty_write failed", e);
    }
    navigate("/");
  };

  const handleSaveTemplate = async (meal: Meal) => {
    const name = window.prompt(
      `Save "${MEAL_LABEL[meal.meal_type] ?? meal.meal_type}" as a template named:`,
      `My ${meal.meal_type}`,
    );
    if (!name?.trim()) return;
    try {
      await invoke("save_meal_as_template", {
        mealId: meal.activity_id,
        name: name.trim(),
      });
      refetchTemplates();
    } catch (e) {
      console.error("save template failed", e);
      alert(`Failed to save: ${e}`);
    }
  };

  const handleApplyTemplate = async (t: MealTemplate) => {
    if (busy()) return;
    setBusy(true);
    try {
      await invoke("apply_meal_template", { templateId: t.id });
      refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (t: MealTemplate, e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await invoke("delete_meal_template", { templateId: t.id });
      refetchTemplates();
    } catch (err) {
      console.error("delete template failed", err);
    }
  };

  const calPct = () => {
    const t = dayData();
    if (!t) return 0;
    return Math.min(100, Math.round((t.totals.calories / effectiveCalTarget()) * 100));
  };
  const proteinPct = () => {
    const t = dayData();
    if (!t) return 0;
    return Math.min(100, Math.round((t.totals.protein_g / effectiveProteinTarget()) * 100));
  };

  return (
    <div class="page food-page">
      <header class="page-header">
        <h1>Food</h1>
      </header>

      {/* View controls: tab toggle + period-specific date nav. */}
      <div class="flex items-center justify-end gap-2 mb-4 flex-wrap">
        <div class="view-toggle">
          <button
            classList={{ active: view() === "day" }}
            onClick={() => setView("day")}
          >
            Day
          </button>
          <button
            classList={{ active: view() === "week" }}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            classList={{ active: view() === "month" }}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
        {/* Period nav. Unified across views so the ← / label / → positions
            stay fixed and only the label content swaps. Today button sits
            in its own reserved slot on the left — invisible when not
            applicable so nothing shifts. */}
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
        <Button variant="ghost" size="sm" onClick={refreshAll}>
          ↻
        </Button>
      </div>

      {/* Period-specific stats. Day shows totals; Week/Month show
          averages + aggregates. Lives below the tabs since the stats
          change with the selected period. */}
      <FoodInsightsBar
        view={view()}
        date={viewDate()}
        weekStart={startOfWeek(viewDate())}
      />

      <Show when={view() === "week"}>
        <WeekView
          days={weekData() ?? []}
          loading={weekFirstLoad()}
          onPickDay={(d) => {
            setViewDate(d);
            setView("day");
          }}
        />
      </Show>

      <Show when={view() === "month"}>
        <MonthView
          days={monthData() ?? []}
          loading={monthFirstLoad()}
          monthStr={viewDate()}
          onPickDay={(d) => {
            setViewDate(d);
            setView("day");
          }}
        />
      </Show>

      <Show when={view() === "day"}>
        {/* Top progress strip */}
        <div class="food-totals">
          <div class="boost-row">
            <Button
              variant={boosted() ? "default" : "outline"}
              size="sm"
              onClick={toggleBoost}
              class="h-7 text-xs"
            >
              {boosted() ? "✓ Workout day" : "Workout day"}
            </Button>
            <Show when={boosted()}>
              <span class="muted small">
                +{BOOST_CAL} cal · +{BOOST_PROTEIN}g protein
              </span>
            </Show>
          </div>

          <div class="totals-row">
            <div class="totals-label">Calories</div>
            <div class="totals-value">
              <strong>{dayData()?.totals.calories ?? 0}</strong>
              <span class="muted"> / {effectiveCalTarget()}</span>
            </div>
            <div class="totals-remaining">
              {Math.max(0, effectiveCalTarget() - (dayData()?.totals.calories ?? 0))}{" "}
              left
            </div>
          </div>
          <div class="bar-track">
            <div class="bar-fill cal" style={{ width: `${calPct()}%` }} />
          </div>

          <div class="totals-row">
            <div class="totals-label">Protein</div>
            <div class="totals-value">
              <strong>{Math.round(dayData()?.totals.protein_g ?? 0)}g</strong>
              <span class="muted"> / {effectiveProteinTarget()}g</span>
            </div>
            <div class="totals-remaining">
              {Math.max(
                0,
                Math.round(effectiveProteinTarget() - (dayData()?.totals.protein_g ?? 0)),
              )}
              g left
            </div>
          </div>
          <div class="bar-track">
            <div class="bar-fill protein" style={{ width: `${proteinPct()}%` }} />
          </div>

          <Show
            when={
              (dayData()?.totals.carbs_g ?? 0) > 0 ||
              (dayData()?.totals.fat_g ?? 0) > 0
            }
          >
            <div class="macros-row">
              <span class="macro">
                <span class="muted">Carbs</span>{" "}
                <strong>{Math.round(dayData()?.totals.carbs_g ?? 0)}g</strong>
              </span>
              <span class="macro">
                <span class="muted">Fat</span>{" "}
                <strong>{Math.round(dayData()?.totals.fat_g ?? 0)}g</strong>
              </span>
            </div>
          </Show>
        </div>

        <div class="food-grid">
          {/* Left: Meals panel — each meal type is a collapsible row.
              Collapsed shows aggregates (cal/protein); expanded shows items. */}
          <Card class="meal-log">
            <CardHeader class="pb-3">
              <CardTitle class="text-base">Meals</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2 pt-0">
              <Show when={dayFirstLoad()}>
                <div class="text-sm text-muted-foreground">Loading…</div>
              </Show>

              <Show when={today.error}>
                <div class="text-sm text-destructive">
                  Couldn't load today's food.{" "}
                  <span class="text-muted-foreground">
                    {String(today.error)}
                  </span>
                </div>
              </Show>

              <Show
                when={
                  dayData() && dayData()!.meals.length === 0 && !dayFirstLoad()
                }
              >
                <div class="text-sm text-muted-foreground py-2">
                  {isToday()
                    ? "No meals logged today yet. Add one →"
                    : "Nothing logged on this day."}
                </div>
              </Show>

              <For each={sortMealsByTime(dayData()?.meals ?? [])}>
                {(m) => {
                  const open = () => isExpanded(m.activity_id);
                  const label = () =>
                    MEAL_LABEL[m.meal_type.toLowerCase()] ?? m.meal_type;
                  return (
                    <div class="rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        class="w-full flex items-center justify-between p-3 text-left hover:bg-accent/20 transition-colors"
                        onClick={() => toggleMeal(m.activity_id)}
                        aria-expanded={open()}
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="text-xs text-muted-foreground w-3 inline-block transition-transform"
                            classList={{ "rotate-90": open() }}
                          >
                            ▶
                          </span>
                          <span class="font-medium text-sm tracking-wide uppercase">
                            {label()}
                          </span>
                          <span class="text-xs text-muted-foreground ml-1">
                            {fmtTime(m.created_at)}
                          </span>
                        </div>
                        <div class="flex items-center gap-3 text-sm">
                          <span class="font-medium">
                            {m.total_calories ?? 0} cal
                          </span>
                          <span class="text-muted-foreground">
                            / {Math.round(m.total_protein_g ?? 0)}g
                          </span>
                          <Show when={isToday()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              class="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveTemplate(m);
                              }}
                              title="Save as template"
                            >
                              Save
                            </Button>
                          </Show>
                        </div>
                      </button>
                      <Show when={open()}>
                        <div class="border-t border-border">
                          <For each={m.items}>
                            {(it) => (
                              <div class="meal-item group">
                                <div class="meal-item-main">
                                  <span class="food-name">
                                    {it.food_name}
                                  </span>
                                  <Show when={it.serving_size}>
                                    <span class="muted serving">
                                      · {it.serving_size}
                                    </span>
                                  </Show>
                                  <Show when={(it.quantity ?? 1) !== 1}>
                                    <span class="muted serving">
                                      × {it.quantity}
                                    </span>
                                  </Show>
                                </div>
                                <div class="meal-item-stats">
                                  <span>{it.calories ?? 0} cal</span>
                                  <span class="muted">
                                    / {Math.round(it.protein_g ?? 0)}g
                                  </span>
                                  <Show when={isToday()}>
                                    <Show when={it.food_id}>
                                      <button
                                        class="item-edit"
                                        title="Edit"
                                        onClick={() =>
                                          setEditingItem({
                                            item_id: it.id,
                                            food_id: it.food_id!,
                                            food_name: it.food_name,
                                            serving_id: it.serving_id,
                                            quantity: it.quantity,
                                          })
                                        }
                                      >
                                        ✎
                                      </button>
                                    </Show>
                                    <button
                                      class="item-delete"
                                      title="Delete"
                                      onClick={() =>
                                        handleDelete(it, m.activity_id)
                                      }
                                    >
                                      ×
                                    </button>
                                  </Show>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </CardContent>
          </Card>

          {/* Right: quick-add panel */}
          <Show when={isToday()}>
            <aside class="quick-add">
              <Input
                type="text"
                placeholder="Search foods..."
                value={search()}
                onInput={(e) => onSearchInput(e.currentTarget.value)}
              />

              <Show when={search().trim().length > 0}>
                <div class="qa-section">
                  <h3>Search results</h3>
                  <Show when={searchResults().length === 0}>
                    <div class="muted small">
                      No matches. Use "Describe to agent" for new foods.
                    </div>
                  </Show>
                  <For each={searchResults()}>
                    {(f) => <QuickAddRow food={f} onPick={setPickerFood} />}
                  </For>
                </div>
              </Show>

              <Show when={search().trim().length === 0}>
                <Show when={templateList().length > 0}>
                  <div class="qa-section">
                    <h3>Saved meals</h3>
                    <For each={templateList()}>
                      {(t) => (
                        <div class="qa-row" onClick={() => handleApplyTemplate(t)}>
                          <div class="qa-main">
                            <div class="qa-name">{t.name}</div>
                            <div class="qa-meta">
                              <span class="muted">{t.items.length} items</span>
                              <span class="dot">·</span>
                              <span>{t.total_calories} cal</span>
                              <span class="muted">
                                / {Math.round(t.total_protein_g)}g
                              </span>
                            </div>
                          </div>
                          <button
                            class="qa-add"
                            title="Apply to today"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyTemplate(t);
                            }}
                          >
                            +
                          </button>
                          <button
                            class="qa-trash"
                            title="Delete template"
                            onClick={(e) => handleDeleteTemplate(t, e)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="qa-section">
                  <h3>Recent</h3>
                  <Show
                    when={recentList().length === 0 && !recent.loading}
                  >
                    <div class="muted small">
                      No foods yet — log a meal to start.
                    </div>
                  </Show>
                  <For each={recentList()}>
                    {(f) => <QuickAddRow food={f} onPick={setPickerFood} />}
                  </For>
                </div>

                <div class="qa-section">
                  <h3>Frequent</h3>
                  <Show
                    when={frequentList().length === 0 && !frequent.loading}
                  >
                    <div class="muted small">—</div>
                  </Show>
                  <For each={frequentList()}>
                    {(f) => <QuickAddRow food={f} onPick={setPickerFood} />}
                  </For>
                </div>
              </Show>

              <div class="qa-section qa-agent">
                <Button
                  variant="secondary"
                  class="w-full"
                  onClick={handleDescribeToAgent}
                >
                  Describe to agent
                </Button>
                <div class="muted small mt-2">
                  Switches to the Agent tab with "I just ate " queued —
                  finish the sentence and Codex logs it.
                </div>
              </div>
            </aside>
          </Show>
        </div>
      </Show>

      <QuickAddDialog
        food={pickerFood()}
        onClose={() => setPickerFood(null)}
        onLogged={refreshAll}
      />

      <EditItemDialog
        item={editingItem()}
        onClose={() => setEditingItem(null)}
        onSaved={refreshAll}
      />

      <Show when={undoItem()}>
        <div class="undo-toast">
          <span class="muted">Deleted "{undoItem()!.food_name}"</span>
          <Button variant="outline" size="sm" onClick={handleUndo}>
            Undo ⌘Z
          </Button>
        </div>
      </Show>
    </div>
  );
}

function QuickAddRow(props: {
  food: FoodRow;
  onPick: (f: FoodRow) => void;
}) {
  const f = props.food;
  const s = f.default_serving;
  return (
    <div class="qa-row" onClick={() => props.onPick(f)}>
      <div class="qa-main">
        <div class="qa-name">{f.display_name}</div>
        <div class="qa-meta">
          <Show when={s}>
            <span class="muted">{s!.label}</span>
            <span class="dot">·</span>
            <span>{s!.calories ?? 0} cal</span>
            <span class="muted">/ {Math.round(s!.protein_g ?? 0)}g</span>
          </Show>
        </div>
      </div>
      <button
        class="qa-add"
        title="Customize and add"
        onClick={(e) => {
          e.stopPropagation();
          props.onPick(f);
        }}
      >
        +
      </button>
    </div>
  );
}

function MonthView(props: {
  days: DaySummary[];
  loading: boolean;
  monthStr: string;
  onPickDay: (date: string) => void;
}) {
  const TARGET_CAL = 2200;
  const today = todayIso();
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build a grid: leading blanks for the first weekday, then days, then trailing blanks
  const cells = () => {
    const days = props.days;
    if (days.length === 0) return [];
    const first = new Date(days[0].date + "T00:00:00");
    const leading = first.getDay(); // Sunday-start
    const out: (DaySummary | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    out.push(...days);
    // Pad to multiple of 7
    while (out.length % 7 !== 0) out.push(null);
    return out;
  };

  // Color intensity from cal vs target ratio
  const heatColor = (d: DaySummary): string => {
    if (d.calories === 0) return "transparent";
    const ratio = d.calories / TARGET_CAL;
    if (ratio < 0.3) return "rgba(123, 217, 123, 0.18)";
    if (ratio < 0.6) return "rgba(123, 217, 123, 0.36)";
    if (ratio < 0.9) return "rgba(123, 217, 123, 0.55)";
    if (ratio < 1.05) return "rgba(123, 217, 123, 0.7)";
    if (ratio < 1.2) return "rgba(255, 185, 104, 0.55)";
    return "rgba(255, 123, 123, 0.55)";
  };

  return (
    <div class="month-view">
      <Show when={props.loading}>
        <div class="empty">Loading…</div>
      </Show>
      <Show when={!props.loading}>
        <div class="month-weekday-row">
          <For each={WEEKDAYS}>
            {(w) => <div class="month-weekday">{w}</div>}
          </For>
        </div>
        <div class="month-grid">
          <For each={cells()}>
            {(c) => (
              <Show
                when={c}
                fallback={<div class="month-cell empty-cell" />}
              >
                <div
                  class="month-cell"
                  classList={{
                    today: c!.date === today,
                    future: c!.date > today,
                  }}
                  style={{ "background-color": heatColor(c!) }}
                  onClick={() => c!.date <= today && props.onPickDay(c!.date)}
                  title={`${c!.date} · ${c!.calories} cal · ${Math.round(c!.protein_g)}g protein`}
                >
                  <div class="month-cell-date">
                    {new Date(c!.date + "T00:00:00").getDate()}
                  </div>
                  <Show when={c!.calories > 0}>
                    <div class="month-cell-cal">{c!.calories}</div>
                  </Show>
                </div>
              </Show>
            )}
          </For>
        </div>
        <div class="month-legend muted small">
          <span>Lighter = less, darker green = on target, orange/red = over</span>
        </div>
      </Show>
    </div>
  );
}

function WeekView(props: {
  days: DaySummary[];
  loading: boolean;
  onPickDay: (date: string) => void;
}) {
  const TARGET_CAL = 2200;
  const TARGET_PROTEIN = 150;
  const today = todayIso();

  const pct = (val: number, target: number) =>
    Math.min(100, Math.round((val / target) * 100));

  return (
    <div class="week-view">
      <Show when={props.loading}>
        <div class="empty">Loading…</div>
      </Show>
      <Show when={!props.loading}>
        <div class="week-grid">
          <For each={props.days}>
            {(d) => {
              const isToday = d.date === today;
              const isFuture = d.date > today;
              const hit =
                d.calories > 0 &&
                d.calories <= TARGET_CAL &&
                d.protein_g >= TARGET_PROTEIN * 0.7;
              return (
                <div
                  class="day-card"
                  classList={{
                    today: isToday,
                    future: isFuture,
                    hit: hit,
                  }}
                  onClick={() => !isFuture && props.onPickDay(d.date)}
                >
                  <div class="day-card-header">
                    <span class="day-weekday">{fmtWeekday(d.date)}</span>
                    <span class="day-num">{fmtDayNum(d.date)}</span>
                  </div>
                  <Show when={!isFuture}>
                    <div class="day-stat">
                      <div class="day-stat-label">cal</div>
                      <div class="day-stat-value">
                        {d.calories}
                        <span class="muted small"> /{TARGET_CAL}</span>
                      </div>
                      <div class="bar-track sm">
                        <div
                          class="bar-fill cal"
                          style={{ width: `${pct(d.calories, TARGET_CAL)}%` }}
                        />
                      </div>
                    </div>
                    <div class="day-stat">
                      <div class="day-stat-label">protein</div>
                      <div class="day-stat-value">
                        {Math.round(d.protein_g)}g
                        <span class="muted small"> /{TARGET_PROTEIN}</span>
                      </div>
                      <div class="bar-track sm">
                        <div
                          class="bar-fill protein"
                          style={{ width: `${pct(d.protein_g, TARGET_PROTEIN)}%` }}
                        />
                      </div>
                    </div>
                    <div class="day-meals">
                      <Show when={d.meal_count > 0} fallback={<span class="muted small">no meals</span>}>
                        <span class="muted small">{d.meal_count} meals</span>
                      </Show>
                    </div>
                  </Show>
                  <Show when={isFuture}>
                    <div class="muted small future-label">—</div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
