import { invoke } from "~/lib/telemetry";
import type { AgentDefinition } from "~/lib/agents";

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

type CalendarPayload = {
  title: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  recurrenceRule?: string;
  recurrenceUntil?: string;
};

type FoodPayload = {
  foodId: string;
  foodName: string;
  servingId?: string;
  servingLabel?: string;
  quantity: number;
  mealType?: string;
};

type WeightPayload = {
  weightLbs: number;
  bodyFatPct?: number;
  notes?: string;
};

type LlmAgentDraft = {
  kind: "create_calendar_event" | "log_food" | "log_weight" | "unknown" | string;
  title?: string;
  summary?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string;
  recurrenceRule?: string;
  recurrenceUntil?: string;
  foodName?: string;
  quantity?: number;
  unit?: string;
  mealType?: string;
  weightLbs?: number;
  bodyFatPct?: number;
  notes?: string;
  confidence?: "high" | "medium" | "low" | string;
};

export type AgentActionProposal =
  | {
      id: string;
      kind: "create_calendar_event";
      title: string;
      summary: string;
      payload: CalendarPayload;
      confidence: "high" | "medium" | "low";
    }
  | {
      id: string;
      kind: "log_food";
      title: string;
      summary: string;
      payload: FoodPayload;
      confidence: "high" | "medium" | "low";
    }
  | {
      id: string;
      kind: "log_weight";
      title: string;
      summary: string;
      payload: WeightPayload;
      confidence: "high" | "medium" | "low";
    }
  | {
      id: string;
      kind: "unknown";
      title: string;
      summary: string;
      payload: { request: string };
      confidence: "low";
    };

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  thirtieth: 30,
  "thirty first": 31,
  "thirty-first": 31,
};

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function isoDate(month: number, day: number): string {
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseMonthDay(text: string): string | null {
  const lower = text.toLowerCase();
  const monthAlternation = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  const match = lower.match(
    new RegExp(`\\b(${monthAlternation})\\s+([a-z-]+(?:\\s+[a-z-]+)?|\\d{1,2})(?:st|nd|rd|th)?\\b`),
  );
  if (!match) return null;

  const month = MONTHS[match[1]];
  const rawDay = match[2].replace(/(?:st|nd|rd|th)$/i, "").trim();
  const day = Number(rawDay) || ORDINALS[rawDay];
  if (!month || !day || day < 1 || day > 31) return null;
  return isoDate(month, day);
}

function calendarTitle(request: string): string {
  const lower = request.toLowerCase();
  const eventType = lower.includes("anniversary") ? "anniversary" : lower.includes("birthday") ? "birthday" : "event";
  const beforeDate = request
    .replace(/\b(is|on|every)\b.*$/i, "")
    .replace(/\b(my|the|a|an)\b/gi, "")
    .replace(/\b(birthday|anniversary|event)\b/gi, "")
    .replace(/[.,]/g, " ")
    .trim();
  const name = beforeDate
    .replace(/'s\b/gi, "")
    .replace(/\bwife\b/i, "wife")
    .replace(/\bbrother\b/i, "brother")
    .replace(/\s+/g, " ")
    .trim();
  return titleCase(`${name || eventType} ${eventType}`);
}

function proposeCalendar(request: string): AgentActionProposal | null {
  const lower = request.toLowerCase();
  if (!/(birthday|anniversary|appointment|event|concert|meeting|dinner|lunch)/.test(lower)) {
    return null;
  }

  const startsAt = parseMonthDay(request);
  if (!startsAt) return null;
  const recurring = /\b(every|yearly|annual|anniversary|birthday)\b/.test(lower);
  const title = calendarTitle(request);
  const recurrenceRule = recurring ? "yearly" : undefined;

  return {
    id: newId(),
    kind: "create_calendar_event",
    title: "Create calendar event",
    summary: `${recurrenceRule ? "Yearly all-day" : "All-day"} event: ${title} on ${startsAt}`,
    confidence: lower.includes("birthday") || lower.includes("anniversary") ? "high" : "medium",
    payload: {
      title,
      startsAt,
      allDay: true,
      recurrenceRule,
      notes: `Created from agent request: ${request}`,
    },
  };
}

function proposeWeight(request: string): AgentActionProposal | null {
  const lower = request.toLowerCase();
  if (!/(weight|weigh)/.test(lower)) return null;
  const match = lower.match(/\b(\d{2,3}(?:\.\d+)?)\s*(?:lb|lbs|pounds)?\b/);
  if (!match) return null;
  const weightLbs = Number(match[1]);
  if (!Number.isFinite(weightLbs)) return null;
  return {
    id: newId(),
    kind: "log_weight",
    title: "Log weight",
    summary: `Log body weight: ${weightLbs} lb`,
    confidence: "high",
    payload: {
      weightLbs,
      notes: `Created from agent request: ${request}`,
    },
  };
}

function mealTypeFromRequest(request: string): string | undefined {
  const lower = request.toLowerCase();
  if (/\bbreakfast\b/.test(lower)) return "breakfast";
  if (/\blunch\b/.test(lower)) return "lunch";
  if (/\bdinner\b/.test(lower)) return "dinner";
  if (/\bsnack\b/.test(lower)) return "snack";
  return undefined;
}

function foodQueryFromRequest(request: string): string {
  return request
    .toLowerCase()
    .replace(/\b(i ate|i am eating|i'm eating|log|ate|as a|for|snack|breakfast|lunch|dinner)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(g|gram|grams|oz|ounce|ounces|lb|lbs|pounds)?\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function proposeFood(request: string): Promise<AgentActionProposal | null> {
  const lower = request.toLowerCase();
  if (!/(ate|eating|food|snack|breakfast|lunch|dinner|log)/.test(lower)) return null;
  const query = foodQueryFromRequest(request);
  if (!query) return null;
  const foods = await invoke<FoodRow[]>("search_foods", { query, limit: 5 }).catch(() => []);
  const food = foods[0];
  if (!food) return null;
  const servings = await invoke<Serving[]>("list_food_servings", { foodId: food.id }).catch(() => []);
  const grams = Number(lower.match(/\b(\d+(?:\.\d+)?)\s*g(?:rams?)?\b/)?.[1]);
  const serving =
    Number.isFinite(grams) && grams > 0
      ? servings.find((item) => /100\s*g/i.test(item.label)) ?? food.default_serving
      : food.default_serving ?? servings[0];
  const quantity =
    Number.isFinite(grams) && grams > 0 && serving && /100\s*g/i.test(serving.label)
      ? Math.round((grams / 100) * 100) / 100
      : 1;
  const mealType = mealTypeFromRequest(request);

  return {
    id: newId(),
    kind: "log_food",
    title: "Log food",
    summary: `Log ${quantity} x ${serving?.label ?? "default serving"} ${food.display_name}${mealType ? ` as ${mealType}` : ""}`,
    confidence: food ? "medium" : "low",
    payload: {
      foodId: food.id,
      foodName: food.display_name,
      servingId: serving?.id,
      servingLabel: serving?.label,
      quantity,
      mealType,
    },
  };
}

function confidence(value: LlmAgentDraft["confidence"]): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function validRecurrenceRule(value: string | undefined): string | undefined {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly"
    ? value
    : undefined;
}

async function proposeLlmFallback(
  request: string,
  agent?: AgentDefinition,
): Promise<AgentActionProposal | null> {
  const draft = await invoke<LlmAgentDraft>("draft_agent_action_with_llm", {
    input: {
      agentId: agent?.id,
      instruction: agent?.instruction,
      request,
    },
  }).catch(() => null);
  if (!draft || draft.kind === "unknown") return null;

  if (draft.kind === "create_calendar_event") {
    if (!draft.title || !draft.startsAt) return null;
    const recurrenceRule = validRecurrenceRule(draft.recurrenceRule);
    return {
      id: newId(),
      kind: "create_calendar_event",
      title: "Create calendar event",
      summary:
        draft.summary ??
        `${recurrenceRule ? `${titleCase(recurrenceRule)} recurring` : "Calendar"} event: ${draft.title}`,
      confidence: confidence(draft.confidence),
      payload: {
        title: draft.title,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        allDay: draft.allDay ?? true,
        location: draft.location,
        recurrenceRule,
        recurrenceUntil: draft.recurrenceUntil,
        notes: draft.notes ?? `Created from agent request: ${request}`,
      },
    };
  }

  if (draft.kind === "log_weight") {
    if (!draft.weightLbs || !Number.isFinite(draft.weightLbs)) return null;
    return {
      id: newId(),
      kind: "log_weight",
      title: "Log weight",
      summary: draft.summary ?? `Log body weight: ${draft.weightLbs} lb`,
      confidence: confidence(draft.confidence),
      payload: {
        weightLbs: draft.weightLbs,
        bodyFatPct: draft.bodyFatPct,
        notes: draft.notes ?? `Created from agent request: ${request}`,
      },
    };
  }

  if (draft.kind === "log_food") {
    const foodName = draft.foodName?.trim();
    if (!foodName) return null;
    const foods = await invoke<FoodRow[]>("search_foods", { query: foodName, limit: 5 }).catch(() => []);
    const food = foods[0];
    if (!food) {
      return {
        id: newId(),
        kind: "unknown",
        title: "Needs food entry",
        summary: `I understood "${foodName}", but it is not in your food database yet.`,
        confidence: "low",
        payload: { request },
      };
    }

    const servings = await invoke<Serving[]>("list_food_servings", { foodId: food.id }).catch(() => []);
    const quantity = draft.quantity && Number.isFinite(draft.quantity) ? draft.quantity : 1;
    const serving =
      draft.unit?.toLowerCase() === "g"
        ? servings.find((item) => /100\s*g/i.test(item.label)) ?? food.default_serving ?? servings[0]
        : food.default_serving ?? servings[0];
    const servingQuantity =
      draft.unit?.toLowerCase() === "g" && serving && /100\s*g/i.test(serving.label)
        ? Math.round((quantity / 100) * 100) / 100
        : quantity;

    return {
      id: newId(),
      kind: "log_food",
      title: "Log food",
      summary:
        draft.summary ??
        `Log ${servingQuantity} x ${serving?.label ?? "default serving"} ${food.display_name}${
          draft.mealType ? ` as ${draft.mealType}` : ""
        }`,
      confidence: confidence(draft.confidence),
      payload: {
        foodId: food.id,
        foodName: food.display_name,
        servingId: serving?.id,
        servingLabel: serving?.label,
        quantity: servingQuantity,
        mealType: draft.mealType,
      },
    };
  }

  return null;
}

export async function proposeAgentAction(
  request: string,
  agent?: AgentDefinition,
): Promise<AgentActionProposal> {
  const calendar = proposeCalendar(request);
  if (calendar) return calendar;

  const weight = proposeWeight(request);
  if (weight) return weight;

  const food = await proposeFood(request);
  if (food) return food;

  const llm = await proposeLlmFallback(request, agent);
  if (llm) return llm;

  return {
    id: newId(),
    kind: "unknown",
    title: "Needs review",
    summary: "I could not map this to a safe app action yet.",
    confidence: "low",
    payload: { request },
  };
}

export async function executeAgentAction(proposal: AgentActionProposal): Promise<string> {
  if (proposal.kind === "create_calendar_event") {
    const id = await invoke<string>("create_calendar_event", { input: proposal.payload });
    return `Created calendar event. ID ${id}.`;
  }
  if (proposal.kind === "log_food") {
    await invoke("log_quick_add", {
      foodId: proposal.payload.foodId,
      servingId: proposal.payload.servingId,
      quantity: proposal.payload.quantity,
      mealType: proposal.payload.mealType,
    });
    return `Logged ${proposal.payload.foodName}.`;
  }
  if (proposal.kind === "log_weight") {
    const id = await invoke<string>("log_weight_activity", {
      weightLbs: proposal.payload.weightLbs,
      bodyFatPct: proposal.payload.bodyFatPct,
      notes: proposal.payload.notes,
    });
    return `Logged weight. Activity ID ${id}.`;
  }
  throw new Error("No executable action was proposed.");
}
