export type AgentId = "calendar" | "food" | "activity" | "journal" | "planning";

export type AgentDefinition = {
  id: AgentId;
  name: string;
  icon: string;
  description: string;
  placeholder: string;
  shortcut?: string;
  examples: string[];
  instruction: string;
};

export const AGENTS: AgentDefinition[] = [
  {
    id: "calendar",
    name: "Calendar Agent",
    icon: "◇",
    description: "Schedule, update, and reason about calendar events.",
    placeholder: "My parents anniversary is every May 14",
    shortcut: "⌘⇧P",
    examples: [
      "Dinner with Alex next Friday at 7pm",
      "Dentist appointment every 6 months starting June 3",
      "My parents anniversary is every May 14",
    ],
    instruction:
      "You are the Calendar Agent for mylife. Use calendar event tools/MCP when available. For creation, if the request says repeat, recurring, annual, anniversary, birthday, every day, every week, every month, or every year, include the appropriate recurrence_rule: daily, weekly, monthly, or yearly. For deletion, use delete_calendar_event with the event activity_id when the user identifies an event. Ask one concise follow-up only if the date, time, recurrence, title, or event identity is too ambiguous to act safely.",
  },
  {
    id: "food",
    name: "Food Agent",
    icon: "◍",
    description: "Log meals, create foods, and fix nutrition entries.",
    placeholder: "I ate 200g chicken thigh as a snack",
    examples: [
      "I ate 200g chicken thigh as a snack",
      "Add a new food for my protein shake",
      "Fix lunch, that burrito should have been dinner",
    ],
    instruction:
      "You are the Food Agent for mylife. Use food and meal tools/MCP when available. Prefer existing foods and servings when they match. Ask one concise follow-up only when the food, serving, meal type, or nutrition is too ambiguous to log safely.",
  },
  {
    id: "activity",
    name: "Activity Agent",
    icon: "▦",
    description: "Log, search, summarize, and organize activities.",
    placeholder: "Log that I finished cleaning the garage",
    examples: [
      "Log that I finished cleaning the garage",
      "Show me what I did this week",
      "Add a task to replace the HVAC filter",
    ],
    instruction:
      "You are the Activity Agent for mylife. Use activity and task tools/MCP when available. Keep activity names concise and statuses accurate. Ask one concise follow-up only when the activity type, timing, or status is too ambiguous.",
  },
  {
    id: "journal",
    name: "Journal Agent",
    icon: "◫",
    description: "Open journals, summarize entries, and capture reflections.",
    placeholder: "Open today's daily journal",
    examples: [
      "Open today's daily journal",
      "Summarize this week's journal",
      "Capture a quick note about today",
    ],
    instruction:
      "You are the Journal Agent for mylife. Use journal tools and markdown files when available. Preserve the user's wording for journal content. Ask one concise follow-up only if the target interval or entry is unclear.",
  },
  {
    id: "planning",
    name: "Planning Agent",
    icon: "◐",
    description: "Plan days, tasks, workouts, and priorities.",
    placeholder: "Help me plan tomorrow around a low-energy morning",
    examples: [
      "Help me plan tomorrow",
      "What should I focus on today?",
      "Make a sustainable workout plan for this week",
    ],
    instruction:
      "You are the Planning Agent for mylife. Connect plans to the user's goals while keeping them sustainable. Ask how the user is feeling before prescribing a full day plan when needed.",
  },
];

export function agentById(id: AgentId): AgentDefinition {
  return AGENTS.find((agent) => agent.id === id) ?? AGENTS[0];
}

export function agentForPath(pathname: string): AgentId {
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/food")) return "food";
  if (pathname.startsWith("/activities")) return "activity";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/plans")) return "planning";
  return "calendar";
}

export function buildAgentPrompt(agent: AgentDefinition, request: string): string {
  return [
    agent.instruction,
    "",
    `Request: ${request.trim()}`,
    "",
  ].join("\n");
}
