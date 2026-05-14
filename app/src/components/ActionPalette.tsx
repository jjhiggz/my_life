import { createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { invoke } from "~/lib/telemetry";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";

function agentPrompt(request: string): string {
  return [
    "Create a calendar event in HiggzLife from this request.",
    "",
    "Use the calendar event MCP/tool if available. Ask one concise follow-up only if the date, time, or title is too ambiguous to create the event safely.",
    "",
    `Request: ${request.trim()}`,
    "",
  ].join("\n");
}

export default function ActionPalette(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  let textareaRef: HTMLTextAreaElement | undefined;
  const navigate = useNavigate();
  const [request, setRequest] = createSignal("");
  const [message, setMessage] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    if (!props.open) return;
    setRequest("");
    setMessage(null);
    queueMicrotask(() => textareaRef?.focus());
  });

  const sendToAgent = async () => {
    const text = request().trim();
    if (!text || busy()) return;
    setBusy(true);
    try {
      await invoke("pty_write", { data: `${agentPrompt(text)}\n` });
      props.onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("pty_write failed", error);
      setMessage("Could not send this to the agent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="top-[14%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <div class="border-b border-border px-4 py-3">
          <DialogTitle class="text-sm">Create calendar event</DialogTitle>
          <DialogDescription class="mt-1 text-xs">
            Describe the event naturally. The agent will turn it into a calendar
            event through the app tools.
          </DialogDescription>
        </div>

        <div class="space-y-3 p-4">
          <div class="grid gap-2">
            <Label>Event request</Label>
            <textarea
              ref={textareaRef}
              class="min-h-32 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={request()}
              placeholder="Dinner with Alex next Friday at 7pm at The Dabney"
              onInput={(event) => setRequest(event.currentTarget.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void sendToAgent();
                }
              }}
            />
          </div>
          {message() && (
            <div class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message()}
            </div>
          )}
        </div>

        <div class="flex items-center justify-between border-t border-border px-4 py-2">
          <span class="text-[11px] text-muted-foreground">⌘↵ send to agent</span>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
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
      </DialogContent>
    </Dialog>
  );
}
