import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { agentById } from "~/lib/agents";
import {
  agentApprovals,
  agentMessages,
  agentRuntimeAvailable,
  approveAgentAction,
  initializeAgentSession,
  rejectAgentAction,
  runtimeState,
  selectedAgentId,
  sendAgentRequest,
  startAgentRuntime,
} from "~/lib/agentSession";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function statusLabel(state: ReturnType<typeof runtimeState>) {
  if (!agentRuntimeAvailable()) return "Not connected";
  if (state === "running") return "Running";
  if (state === "starting") return "Starting";
  if (state === "error") return "Needs attention";
  return "Stopped";
}

function proposalDetail(approval: ReturnType<typeof agentApprovals>[number]) {
  const proposal = approval.proposal;
  if (proposal.kind === "create_calendar_event") {
    return [
      ["Title", proposal.payload.title],
      ["Starts", proposal.payload.startsAt],
      ["All day", proposal.payload.allDay ? "Yes" : "No"],
      ["Repeats", proposal.payload.recurrenceRule ?? "No"],
    ];
  }
  if (proposal.kind === "log_food") {
    return [
      ["Food", proposal.payload.foodName],
      ["Serving", proposal.payload.servingLabel ?? "Default"],
      ["Quantity", String(proposal.payload.quantity)],
      ["Meal", proposal.payload.mealType ?? "Current meal"],
    ];
  }
  if (proposal.kind === "log_weight") {
    return [
      ["Weight", `${proposal.payload.weightLbs} lb`],
      ["Notes", proposal.payload.notes ?? ""],
    ];
  }
  return [["Request", proposal.payload.request]];
}

export default function AgentWorkspace() {
  let composerRef: HTMLTextAreaElement | undefined;
  let scrollRef: HTMLDivElement | undefined;
  const [draft, setDraft] = createSignal("");
  const activeAgent = createMemo(() => agentById(selectedAgentId()));

  onMount(() => {
    initializeAgentSession();
  });

  const submit = async () => {
    const text = draft().trim();
    if (!text) return;
    setDraft("");
    await sendAgentRequest(activeAgent(), text);
    queueMicrotask(() => {
      if (!scrollRef) return;
      scrollRef.scrollTop = scrollRef.scrollHeight;
    });
  };

  return (
    <div class="flex h-full min-h-0 flex-col bg-background">
      <div class="border-b border-border px-6 py-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-sm text-muted-foreground">Agent workspace</div>
            <h1 class="mt-1 text-2xl font-semibold tracking-tight">Agents</h1>
            <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pick a focused agent, start a conversation from here or Cmd+Shift+P,
              approve the proposed action, then let the app tool run.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <div
              class={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                runtimeState() === "running"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  : runtimeState() === "error" || !agentRuntimeAvailable()
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {statusLabel(runtimeState())}
            </div>
            <Button variant="outline" size="sm" onClick={startAgentRuntime}>
              Start
            </Button>
          </div>
        </div>
        <div class="mt-5 flex gap-2 overflow-x-auto pb-1">
          <div class="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            One agent, narrow tools, explicit approval before every write.
          </div>
        </div>
      </div>

      <div ref={scrollRef} class="min-h-0 flex-1 overflow-auto px-6 py-5">
        <Show
          when={agentMessages().length}
          fallback={
            <div class="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
              <div class="text-sm font-medium">No agent work yet</div>
              <div class="mt-1 text-sm text-muted-foreground">
                Send a request here, or press Cmd+Shift+P from anywhere.
              </div>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={agentApprovals()}>
              {(approval) => (
                <div
                  class={cn(
                    "max-w-3xl rounded-lg border px-4 py-3 text-sm",
                    approval.status === "executed"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : approval.status === "error" || approval.status === "rejected"
                        ? "border-destructive/30 bg-destructive/10"
                        : "border-primary/30 bg-primary/5",
                  )}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Approval required
                      </div>
                      <div class="mt-1 font-medium">{approval.proposal.title}</div>
                      <div class="mt-1 text-muted-foreground">{approval.proposal.summary}</div>
                    </div>
                    <div class="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {approval.status}
                    </div>
                  </div>
                  <div class="mt-3 grid gap-2 sm:grid-cols-2">
                    <For each={proposalDetail(approval)}>
                      {([label, value]) => (
                        <div class="rounded border border-border bg-background/60 px-2 py-1.5">
                          <div class="text-[10px] uppercase text-muted-foreground">{label}</div>
                          <div class="mt-0.5 break-words">{value || "-"}</div>
                        </div>
                      )}
                    </For>
                  </div>
                  <Show when={approval.status === "pending" && approval.proposal.kind !== "unknown"}>
                    <div class="mt-3 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rejectAgentAction(approval.id)}
                      >
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => void approveAgentAction(approval.id)}>
                        Approve
                      </Button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
            <For each={agentMessages()}>
              {(message) => (
                <div
                  class={cn(
                    "max-w-3xl rounded-lg border px-4 py-3 text-sm",
                    message.role === "user"
                      ? "ml-auto border-primary/30 bg-primary/10"
                      : message.role === "status" && message.state === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                      : message.role === "status" && message.state === "error"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : message.role === "status" && message.state === "running"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-100"
                      : message.role === "status"
                        ? "border-border bg-muted/40 text-muted-foreground"
                      : "border-border bg-card",
                  )}
                >
                  <Show when={message.role === "status"}>
                    <div class="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-70">
                      {message.state === "success"
                        ? "Done"
                        : message.state === "error"
                          ? "Error"
                        : message.state === "running"
                          ? "Tool call"
                          : "Waiting"}
                    </div>
                  </Show>
                  <div>{message.text}</div>
                  <Show when={message.steps}>
                    <div class="mt-3 space-y-2">
                      <For each={message.steps}>
                        {(step, index) => (
                          <div class="flex gap-2 text-xs text-muted-foreground">
                            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              {index() + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="border-t border-border p-4">
        <textarea
          ref={composerRef}
          class="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          value={draft()}
          placeholder={activeAgent().placeholder}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div class="mt-2 flex items-center justify-between">
          <span class="text-[11px] text-muted-foreground">
            {agentRuntimeAvailable()
              ? "Type start to wake the runtime"
              : "Runtime unavailable in browser preview"}
          </span>
          <Button size="sm" disabled={!draft().trim()} onClick={submit}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
