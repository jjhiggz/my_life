import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  THEME_PRESETS,
  applyAndSaveTheme,
  loadCustomTheme,
  loadSavedThemeId,
  loadSavedThemeMode,
  parseThemeBundle,
  saveThemeMode,
  themeCss,
  themeVarsForMode,
  type ThemeMode,
  type ThemeVars,
} from "~/lib/theme";
import {
  clearAgentApiToken,
  getAgentSettings,
  saveAgentSettings,
} from "~/lib/agentSettings";

function savedPresetId(): string {
  const saved = loadSavedThemeId();
  return THEME_PRESETS.some((theme) => theme.id === saved)
    ? saved
    : THEME_PRESETS[0].id;
}

const REQUIRED_THEME_KEYS = ["background", "foreground", "primary", "border"];

function swatchStyle(vars: ThemeVars, key: string): Record<string, string> {
  return vars[key] ? { background: `hsl(${vars[key]})` } : {};
}

export default function Settings() {
  const custom = loadCustomTheme();
  const [selectedTheme, setSelectedTheme] = createSignal(savedPresetId());
  const [mode, setMode] = createSignal<ThemeMode>(loadSavedThemeMode());
  const [customCss, setCustomCss] = createSignal(
    custom ? themeCss(custom) : themeCss(THEME_PRESETS[0].vars),
  );
  const [message, setMessage] = createSignal<string | null>(null);
  const [agentProvider, setAgentProvider] = createSignal("openai");
  const [agentModel, setAgentModel] = createSignal("gpt-5-mini");
  const [agentEndpoint, setAgentEndpoint] = createSignal("https://api.openai.com/v1/responses");
  const [agentToken, setAgentToken] = createSignal("");
  const [agentTokenConfigured, setAgentTokenConfigured] = createSignal(false);
  const [agentMessage, setAgentMessage] = createSignal<string | null>(null);

  const parsedCustom = createMemo(() => parseThemeBundle(customCss()));
  const parsedCustomVars = createMemo(() =>
    themeVarsForMode(parsedCustom(), mode()),
  );
  const missingCustomKeys = createMemo(() =>
    REQUIRED_THEME_KEYS.filter((key) => !parsedCustomVars()[key]),
  );

  onMount(async () => {
    try {
      const settings = await getAgentSettings();
      setAgentProvider(settings.provider);
      setAgentModel(settings.model);
      setAgentEndpoint(settings.endpoint);
      setAgentTokenConfigured(settings.api_token_configured);
    } catch (error) {
      setAgentMessage(error instanceof Error ? error.message : "Could not load agent settings");
    }
  });

  const applyPreset = (id: string | null | undefined) => {
    const preset = THEME_PRESETS.find((theme) => theme.id === id);
    if (!preset) return;
    applyAndSaveTheme(preset.id, preset.vars, mode());
    setSelectedTheme(preset.id);
    setMessage("Saved");
  };

  const saveAgent = async () => {
    setAgentMessage(null);
    try {
      const settings = await saveAgentSettings({
        provider: agentProvider(),
        model: agentModel(),
        endpoint: agentEndpoint(),
        api_token: agentToken(),
      });
      setAgentProvider(settings.provider);
      setAgentModel(settings.model);
      setAgentEndpoint(settings.endpoint);
      setAgentTokenConfigured(settings.api_token_configured);
      setAgentToken("");
      setAgentMessage("Saved");
    } catch (error) {
      setAgentMessage(error instanceof Error ? error.message : "Could not save agent settings");
    }
  };

  const clearToken = async () => {
    setAgentMessage(null);
    try {
      const settings = await clearAgentApiToken();
      setAgentTokenConfigured(settings.api_token_configured);
      setAgentToken("");
      setAgentMessage("Token cleared");
    } catch (error) {
      setAgentMessage(error instanceof Error ? error.message : "Could not clear token");
    }
  };

  const applyMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    saveThemeMode(nextMode);
    if (selectedTheme() === "custom") {
      applyAndSaveTheme("custom", parsedCustom(), nextMode);
      setMessage("Saved");
      return;
    }
    const preset =
      THEME_PRESETS.find((theme) => theme.id === selectedTheme()) ??
      THEME_PRESETS[0];
    applyAndSaveTheme(preset.id, preset.vars, nextMode);
    setMessage("Saved");
  };

  const applyCustomTheme = () => {
    if (missingCustomKeys().length > 0) {
      setMessage(`Missing required tokens: ${missingCustomKeys().join(", ")}`);
      return;
    }
    applyAndSaveTheme("custom", parsedCustom(), mode());
    setSelectedTheme("custom");
    setMessage("Custom theme applied");
  };

  return (
    <div class="p-8">
      <header class="mb-6">
        <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
      </header>

      <Card class="max-w-2xl">
        <CardHeader>
          <CardTitle>Interface</CardTitle>
        </CardHeader>
        <CardContent class="space-y-5">
          <div class="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
            <Label>Theme</Label>
            <Select
              options={THEME_PRESETS.map((theme) => theme.id)}
              value={selectedTheme()}
              onChange={applyPreset}
              itemComponent={(props) => {
                const theme = THEME_PRESETS.find(
                  (preset) => preset.id === props.item.rawValue,
                );
                return (
                  <SelectItem item={props.item}>
                    {theme?.name ?? props.item.rawValue}
                  </SelectItem>
                );
              }}
            >
              <SelectTrigger class="w-full sm:max-w-xs">
                <SelectValue<string>>
                  {(state) =>
                    THEME_PRESETS.find(
                      (theme) => theme.id === state.selectedOption(),
                    )?.name ?? "Select theme"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <div class="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
            <Label>Mode</Label>
            <div class="flex items-center gap-3">
              <div class="inline-flex rounded-md border border-border bg-card p-1">
                <Button
                  variant={mode() === "light" ? "default" : "ghost"}
                  size="sm"
                  aria-pressed={mode() === "light"}
                  onClick={() => applyMode("light")}
                >
                  Light
                </Button>
                <Button
                  variant={mode() === "dark" ? "default" : "ghost"}
                  size="sm"
                  aria-pressed={mode() === "dark"}
                  onClick={() => applyMode("dark")}
                >
                  Dark
                </Button>
              </div>
              <Show when={message()}>
                <span class="text-sm text-muted-foreground">{message()}</span>
              </Show>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Import TweakCN Theme</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <textarea
            class="min-h-72 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={customCss()}
            spellcheck={false}
            onInput={(event) => setCustomCss(event.currentTarget.value)}
          />

          <div class="flex flex-wrap items-center gap-3">
            <Button onClick={applyCustomTheme}>Apply Custom Theme</Button>
            <Show when={selectedTheme() === "custom"}>
              <span class="text-sm text-muted-foreground">Custom theme active</span>
            </Show>
            <Show when={message()}>
              <span class="text-sm text-muted-foreground">{message()}</span>
            </Show>
          </div>

          <Show when={Object.keys(parsedCustom()).length > 0}>
            <div class="flex flex-wrap gap-2">
              <For each={["background", "foreground", "primary", "accent", "border", "ring"]}>
                {(key) => (
                  <div class="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                    <span
                      class="h-3 w-3 rounded-full border border-border"
                      style={swatchStyle(parsedCustomVars(), key)}
                    />
                    {key}
                  </div>
                )}
              </For>
            </div>
          </Show>
        </CardContent>
      </Card>

      <Card class="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Agent</CardTitle>
        </CardHeader>
        <CardContent class="space-y-5">
          <div class="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
            <Label>Provider</Label>
            <Select
              options={["openai"]}
              value={agentProvider()}
              onChange={(value) => value && setAgentProvider(value)}
              itemComponent={(props) => (
                <SelectItem item={props.item}>OpenAI</SelectItem>
              )}
            >
              <SelectTrigger class="w-full sm:max-w-xs">
                <SelectValue<string>>
                  {(state) => (state.selectedOption() === "openai" ? "OpenAI" : "Select provider")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <div class="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
            <Label for="agent-model">Model</Label>
            <Input
              id="agent-model"
              value={agentModel()}
              onInput={(event) => setAgentModel(event.currentTarget.value)}
              placeholder="gpt-5-mini"
              class="sm:max-w-xs"
            />
          </div>

          <div class="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
            <Label for="agent-endpoint">Endpoint</Label>
            <Input
              id="agent-endpoint"
              value={agentEndpoint()}
              onInput={(event) => setAgentEndpoint(event.currentTarget.value)}
              placeholder="https://api.openai.com/v1/responses"
            />
          </div>

          <div class="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center">
            <Label for="agent-token">API token</Label>
            <div class="space-y-2">
              <Input
                id="agent-token"
                type="password"
                value={agentToken()}
                onInput={(event) => setAgentToken(event.currentTarget.value)}
                placeholder={agentTokenConfigured() ? "Token configured" : "Paste OpenAI API key"}
                autocomplete="off"
              />
              <div class="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => void saveAgent()}>
                  Save Agent Settings
                </Button>
                <Show when={agentTokenConfigured()}>
                  <Button size="sm" variant="outline" onClick={() => void clearToken()}>
                    Clear Token
                  </Button>
                </Show>
                <Show when={agentMessage()}>
                  <span class="text-sm text-muted-foreground">{agentMessage()}</span>
                </Show>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
