import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
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
  loadSavedThemeId,
  loadSavedThemeMode,
  saveThemeMode,
  type ThemeMode,
} from "~/lib/theme";

function savedPresetId(): string {
  const saved = loadSavedThemeId();
  return THEME_PRESETS.some((theme) => theme.id === saved)
    ? saved
    : THEME_PRESETS[0].id;
}

export default function Settings() {
  const [selectedTheme, setSelectedTheme] = createSignal(savedPresetId());
  const [mode, setMode] = createSignal<ThemeMode>(loadSavedThemeMode());
  const [message, setMessage] = createSignal<string | null>(null);

  const applyPreset = (id: string | null | undefined) => {
    const preset = THEME_PRESETS.find((theme) => theme.id === id);
    if (!preset) return;
    applyAndSaveTheme(preset.id, preset.vars, mode());
    setSelectedTheme(preset.id);
    setMessage("Saved");
  };

  const applyMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    saveThemeMode(nextMode);
    const preset =
      THEME_PRESETS.find((theme) => theme.id === selectedTheme()) ??
      THEME_PRESETS[0];
    applyAndSaveTheme(preset.id, preset.vars, nextMode);
    setMessage("Saved");
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
    </div>
  );
}
