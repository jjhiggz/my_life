import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  AGENTS,
  agentById,
  agentForPath,
  type AgentDefinition,
  type AgentId,
} from "~/lib/agents";
import {
  agentApprovals,
  agentMessages,
  agentRuntimeAvailable,
  approveAgentAction,
  chooseAgent as chooseSessionAgent,
  initializeAgentSession,
  rejectAgentAction,
  runtimeState,
  sendAgentRequest,
  startAgentRuntime,
} from "~/lib/agentSession";
import { cn } from "~/lib/utils";

function scoreAgent(agent: AgentDefinition, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const haystack = `${agent.name} ${agent.description} ${agent.examples.join(" ")}`.toLowerCase();
  if (haystack.includes(q)) return 20 + q.length;
  let score = 0;
  let lastIndex = -1;
  for (const ch of q) {
    const index = haystack.indexOf(ch, lastIndex + 1);
    if (index === -1) return 0;
    score += index === lastIndex + 1 ? 3 : 1;
    lastIndex = index;
  }
  return score;
}

export default function ActionPalette(props: {
  open: boolean;
  currentPath: string;
  onOpenChange: (open: boolean) => void;
  onViewAgent?: () => void;
}) {
  let searchRef: HTMLInputElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  let messageListRef: HTMLDivElement | undefined;
  const [query, setQuery] = createSignal("");
  const [selectedAgent, setSelectedAgent] = createSignal<AgentId | null>(null);
  const [request, setRequest] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const suggestedAgent = () => agentForPath(props.currentPath);
  const agent = () => (selectedAgent() ? agentById(selectedAgent()!) : null);
  const filteredAgents = createMemo(() =>
    AGENTS.map((item) => ({ item, score: scoreAgent(item, query()) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (!query().trim()) {
          if (a.item.id === suggestedAgent()) return -1;
          if (b.item.id === suggestedAgent()) return 1;
        }
        return b.score - a.score || a.item.name.localeCompare(b.item.name);
      })
      .map((entry) => entry.item),
  );

  createEffect(() => {
    if (!props.open) return;
    initializeAgentSession();
    setQuery("");
    setSelectedAgent(suggestedAgent());
    setRequest("");
    setBusy(false);
    queueMicrotask(() => textareaRef?.focus());
  });

  createEffect(() => {
    agentMessages().length;
    queueMicrotask(() => {
      if (!messageListRef) return;
      messageListRef.scrollTop = messageListRef.scrollHeight;
    });
  });

  const chooseAgent = (id: AgentId) => {
    setSelectedAgent(id);
    chooseSessionAgent(id);
    setRequest("");
    queueMicrotask(() => textareaRef?.focus());
  };

  const sendToAgent = async () => {
    const active = agent();
    const text = request().trim();
    if (!active || !text || busy()) return;

    setBusy(true);
    setRequest("");

    try {
      await sendAgentRequest(active, text);
    } finally {
      setBusy(false);
    }
  };

  const startFromPalette = async () => {
    setBusy(true);
    try {
      startAgentRuntime();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="top-[10%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <Show
          when={agent()}
          fallback={
            <>
              <div class="border-b border-border px-4 py-3">
                  <DialogTitle class="text-sm">Find agent</DialogTitle>
                <DialogDescription class="mt-1 text-xs">
                  Choose a focused agent, start the runtime, or jump to the workspace.
                </DialogDescription>
              </div>
              <div class="border-b border-border p-3">
                <input
                  ref={searchRef}
                  class="h-10 w-full rounded-md border-0 bg-muted/40 px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  value={query()}
                  placeholder="Search agents..."
                  onInput={(event) => setQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const first = filteredAgents()[0];
                      if (first) chooseAgent(first.id);
                    }
                  }}
                />
              </div>
              <div class="max-h-[420px] overflow-auto p-2">
                <For each={filteredAgents()}>
                  {(item) => (
                    <button
                      type="button"
                      class="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
                      onClick={() => chooseAgent(item.id)}
                    >
                      <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                        {item.icon}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="flex items-center gap-2 font-medium">
                          {item.name}
                          <Show when={item.id === suggestedAgent()}>
                            <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                              suggested
                            </span>
                          </Show>
                        </span>
                        <span class="mt-0.5 block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <div class="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                <span>
                  {agentRuntimeAvailable()
                    ? runtimeState() === "running"
                      ? "agent runtime running"
                      : "type start to wake it"
                    : "runtime not connected"}
                </span>
                <button
                  type="button"
                  class="font-medium text-primary"
                  onClick={() => {
                    props.onOpenChange(false);
                    props.onViewAgent?.();
                  }}
                >
                  open workspace
                </button>
              </div>
            </>
          }
        >
          {(active) => (
            <>
              <div class="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <DialogTitle class="flex items-center gap-2 text-sm">
                    <span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      {active().icon}
                    </span>
                    HiggzLife Agent
                  </DialogTitle>
                  <DialogDescription class="mt-1 text-xs">
                    Drafts one app action and asks for approval before anything changes.
                  </DialogDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>
                  Change
                </Button>
              </div>

              <div
                ref={messageListRef}
                class="max-h-[360px] min-h-60 overflow-auto bg-muted/20 p-4"
              >
                <div class="space-y-3">
                  <For each={agentApprovals()}>
                    {(approval) => (
                      <div class="max-w-[86%] rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                        <div class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Approval required
                        </div>
                        <div class="mt-1 font-medium">{approval.proposal.title}</div>
                        <div class="mt-1 text-muted-foreground">{approval.proposal.summary}</div>
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
                          "max-w-[86%] rounded-lg border px-3 py-2 text-sm",
                          message.role === "user"
                            ? "ml-auto border-primary/30 bg-primary/10"
                            : message.role === "status" && message.state === "success"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                            : message.role === "status" && message.state === "error"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : message.role === "status" && message.state === "running"
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-100"
                            : message.role === "status"
                              ? "border-border bg-background text-muted-foreground"
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
              </div>

              <div class="border-t border-border p-3">
                <textarea
                  ref={textareaRef}
                  class="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  value={request()}
                  placeholder={active().placeholder}
                  onInput={(event) => setRequest(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void sendToAgent();
                    }
                  }}
                />
                <div class="mt-2 flex items-center justify-between gap-3">
                  <span class="text-[11px] text-muted-foreground">
                    {agentRuntimeAvailable()
                      ? runtimeState() === "running"
                        ? "⌘↵ send"
                        : "type start or press Start"
                      : "open desktop app to execute"}
                  </span>
                  <div class="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy()}
                      onClick={startFromPalette}
                    >
                      Start
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        props.onOpenChange(false);
                        props.onViewAgent?.();
                      }}
                    >
                      Workspace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => props.onOpenChange(false)}
                    >
                      Close
                    </Button>
                    <Button
                      size="sm"
                      disabled={!request().trim() || busy()}
                      onClick={sendToAgent}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </Show>
      </DialogContent>
    </Dialog>
  );
}
