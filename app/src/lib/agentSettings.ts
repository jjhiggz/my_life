import { invoke } from "~/lib/telemetry";

export type AgentSettings = {
  provider: string;
  model: string;
  endpoint: string;
  api_token_configured: boolean;
};

export type SaveAgentSettingsInput = {
  provider: string;
  model: string;
  endpoint?: string;
  api_token?: string;
};

export function getAgentSettings() {
  return invoke<AgentSettings>("get_agent_settings");
}

export function saveAgentSettings(input: SaveAgentSettingsInput) {
  return invoke<AgentSettings>("save_agent_settings", { input });
}

export function clearAgentApiToken() {
  return invoke<AgentSettings>("clear_agent_api_token");
}
