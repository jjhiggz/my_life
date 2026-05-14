import { createSignal } from "solid-js";
import { type AgentDefinition, type AgentId } from "~/lib/agents";
import {
  executeAgentAction,
  proposeAgentAction,
  type AgentActionProposal,
} from "~/lib/agentActions";

export type AgentMessage = {
  id: string;
  role: "user" | "agent" | "status";
  text: string;
  steps?: string[];
  state?: "waiting" | "running" | "success" | "error";
  agentId?: AgentId;
};

export type AgentRuntimeState = "down" | "starting" | "running" | "error";
export type AgentApproval = {
  id: string;
  proposal: AgentActionProposal;
  request: string;
  status: "pending" | "approved" | "rejected" | "executed" | "error";
  result?: string;
  error?: string;
};

const [agentMessages, setAgentMessages] = createSignal<AgentMessage[]>([]);
const [agentApprovals, setAgentApprovals] = createSignal<AgentApproval[]>([]);
const [selectedAgentId, setSelectedAgentId] = createSignal<AgentId>("calendar");
const [runtimeState] = createSignal<AgentRuntimeState>("running");
const [agentRuntimeAvailable] = createSignal(true);

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function appendMessages(messages: AgentMessage[]) {
  setAgentMessages((current) => [...current, ...messages]);
}

function updateApproval(id: string, patch: Partial<AgentApproval>) {
  setAgentApprovals((current) =>
    current.map((approval) =>
      approval.id === id ? { ...approval, ...patch } : approval,
    ),
  );
}

export function initializeAgentSession() {
  if (!agentMessages().length) {
    appendMessages([
      {
        id: newId(),
        role: "agent",
        text: "mylife Agent is ready. I will draft app actions for approval before changing anything.",
        agentId: selectedAgentId(),
      },
    ]);
  }
}

export function disposeAgentSession() {
  // No-op for the API-style local agent. Kept for call-site compatibility.
}

export function chooseAgent(id: AgentId) {
  initializeAgentSession();
  setSelectedAgentId(id);
}

export function startAgentRuntime() {
  initializeAgentSession();
  appendMessages([
    {
      id: newId(),
      role: "status",
      state: "success",
      text: "The mylife action agent is already running locally.",
      agentId: selectedAgentId(),
    },
  ]);
}

export async function sendAgentRequest(agent: AgentDefinition, request: string) {
  initializeAgentSession();
  setSelectedAgentId(agent.id);
  const text = request.trim();
  if (!text) return;

  appendMessages([
    { id: newId(), role: "user", text, agentId: agent.id },
    {
      id: newId(),
      role: "agent",
      text: "I will turn that into a typed app action and ask before running it.",
      steps: [
        "Parse the request into one safe action.",
        "Show the exact action and data for approval.",
        "Run the app tool only after approval.",
      ],
      agentId: agent.id,
    },
  ]);

  try {
    const proposal = await proposeAgentAction(text, agent);
    const approval: AgentApproval = {
      id: proposal.id,
      proposal,
      request: text,
      status: "pending",
    };
    setAgentApprovals((current) => [...current, approval]);
    appendMessages([
      {
        id: newId(),
        role: "status",
        state: proposal.kind === "unknown" ? "error" : "waiting",
        text:
          proposal.kind === "unknown"
            ? "I could not safely map that request to an app action yet."
            : "Action drafted. Review and approve it before anything changes.",
        agentId: agent.id,
      },
    ]);
  } catch (error) {
    appendMessages([
      {
        id: newId(),
        role: "status",
        state: "error",
        text: error instanceof Error ? error.message : "Could not draft an action.",
        agentId: agent.id,
      },
    ]);
  }
}

export async function approveAgentAction(id: string) {
  const approval = agentApprovals().find((item) => item.id === id);
  if (!approval || approval.status !== "pending") return;
  updateApproval(id, { status: "approved" });
  appendMessages([
    {
      id: newId(),
      role: "status",
      state: "running",
      text: `Approved: ${approval.proposal.title}. Running the app tool now.`,
      agentId: selectedAgentId(),
    },
  ]);
  try {
    const result = await executeAgentAction(approval.proposal);
    updateApproval(id, { status: "executed", result });
    appendMessages([
      {
        id: newId(),
        role: "status",
        state: "success",
        text: result,
        agentId: selectedAgentId(),
      },
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    updateApproval(id, { status: "error", error: message });
    appendMessages([
      {
        id: newId(),
        role: "status",
        state: "error",
        text: message,
        agentId: selectedAgentId(),
      },
    ]);
  }
}

export function rejectAgentAction(id: string) {
  const approval = agentApprovals().find((item) => item.id === id);
  if (!approval || approval.status !== "pending") return;
  updateApproval(id, { status: "rejected" });
  appendMessages([
    {
      id: newId(),
      role: "status",
      state: "error",
      text: `Rejected: ${approval.proposal.title}. Nothing was changed.`,
      agentId: selectedAgentId(),
    },
  ]);
}

export {
  agentApprovals,
  agentMessages,
  agentRuntimeAvailable,
  runtimeState,
  selectedAgentId,
};
