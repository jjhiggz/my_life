// Sentry + Spotlight setup. Local-only — events go to the Spotlight sidecar,
// not to sentry.io. Surface every Tauri command, every nav, every error.

import * as Sentry from "@sentry/browser";
import { invoke as rawInvoke } from "@tauri-apps/api/core";

const isDev = import.meta.env.DEV;

function hasTauriRuntime(): boolean {
  const internals = (window as unknown as {
    __TAURI_INTERNALS__?: { invoke?: unknown; transformCallback?: unknown };
  }).__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function";
}

function browserPreviewFallback<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const emptyArrays = new Set([
    "list_calendar_events",
    "list_logged_activities",
    "list_foods",
    "search_foods",
    "list_food_servings",
    "list_meal_templates",
    "list_plan_dates",
    "list_journal_entries",
  ]);
  if (emptyArrays.has(command)) return Promise.resolve([] as T);
  if (command === "get_agent_settings") {
    return Promise.resolve({
      provider: "openai",
      model: "gpt-5-mini",
      endpoint: "https://api.openai.com/v1/responses",
      api_token_configured: false,
    } as T);
  }
  if (command === "save_agent_settings") {
    const input = args?.input as
      | {
          provider?: string;
          model?: string;
          endpoint?: string;
          api_token?: string;
        }
      | undefined;
    return Promise.resolve({
      provider: input?.provider ?? "openai",
      model: input?.model ?? "gpt-5-mini",
      endpoint: input?.endpoint ?? "https://api.openai.com/v1/responses",
      api_token_configured: Boolean(input?.api_token),
    } as T);
  }
  if (command === "clear_agent_api_token") {
    return Promise.resolve({
      provider: "openai",
      model: "gpt-5-mini",
      endpoint: "https://api.openai.com/v1/responses",
      api_token_configured: false,
    } as T);
  }
  if (command === "pty_write") return Promise.resolve(undefined as T);
  return Promise.reject(new Error(`Tauri runtime unavailable for ${command}`));
}

export function initTelemetry() {
  if (!isDev) return;

  Sentry.init({
    // No DSN — events go to Spotlight only, never to sentry.io
    environment: "dev",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.spotlightBrowserIntegration(),
    ],
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
  });

  // Catch unhandled rejections (the most likely culprit for "stuck Loading")
  window.addEventListener("unhandledrejection", (e) => {
    Sentry.captureException(e.reason, {
      tags: { source: "unhandled-rejection" },
    });
  });

  // Log to console too so the devtools console has it
  Sentry.addBreadcrumb({
    category: "app",
    message: "telemetry initialized",
    level: "info",
  });
}

/**
 * Wrap Tauri's `invoke` with Sentry instrumentation:
 *  - Each call becomes a span tagged with the command name and args summary
 *  - Failures (or hangs caught by timeout) are captured as Sentry events
 *  - Adds a breadcrumb so you can see the recent command history
 *
 * Use this instead of `invoke` from `@tauri-apps/api/core` everywhere.
 */
export function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!hasTauriRuntime()) {
    return browserPreviewFallback<T>(command, args);
  }

  if (!isDev) {
    return rawInvoke<T>(command, args);
  }

  return Sentry.startSpan(
    {
      name: `tauri:${command}`,
      op: "tauri.invoke",
      attributes: {
        command,
        args_keys: args ? Object.keys(args).join(",") : "",
      },
    },
    async () => {
      Sentry.addBreadcrumb({
        category: "tauri",
        message: `invoke ${command}`,
        level: "info",
        data: args ? sanitizeArgs(args) : undefined,
      });
      try {
        const result = await rawInvoke<T>(command, args);
        return result;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { tauri_command: command },
          extra: { args },
        });
        throw err;
      }
    },
  );
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  // Truncate long strings, summarize big arrays, etc.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string" && v.length > 200) {
      out[k] = `${v.slice(0, 200)}…(${v.length} chars)`;
    } else if (Array.isArray(v) && v.length > 10) {
      out[k] = `[${v.length} items]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export { Sentry };
