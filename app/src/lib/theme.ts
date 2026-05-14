export type ThemeMode = "light" | "dark";
export type ThemeVars = Record<string, string>;
export type ThemeBundle = Partial<Record<ThemeMode, ThemeVars>>;

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  vars: Record<ThemeMode, ThemeVars>;
};

const THEME_ID_KEY = "higgzlife:theme:id";
const THEME_MODE_KEY = "higgzlife:theme:mode";
const THEME_CUSTOM_KEY = "higgzlife:theme:custom";
const LEGACY_DEFAULT_THEME_ID = "higgzlife";

const BASE_LIGHT: ThemeVars = {
  background: "0 0% 100%",
  foreground: "240 10% 3.9%",
  card: "0 0% 100%",
  "card-foreground": "240 10% 3.9%",
  popover: "0 0% 100%",
  "popover-foreground": "240 10% 3.9%",
  primary: "207 87% 32%",
  "primary-foreground": "0 0% 98%",
  secondary: "240 4.8% 95.9%",
  "secondary-foreground": "240 5.9% 10%",
  muted: "240 4.8% 95.9%",
  "muted-foreground": "240 3.8% 46.1%",
  accent: "240 4.8% 95.9%",
  "accent-foreground": "240 5.9% 10%",
  destructive: "0 84.2% 60.2%",
  "destructive-foreground": "0 0% 98%",
  border: "240 5.9% 90%",
  input: "240 5.9% 90%",
  ring: "207 87% 32%",
  radius: "0.4rem",
  "chart-1": "207 87% 45%",
  "chart-2": "150 60% 38%",
  "chart-3": "274 62% 52%",
  "chart-4": "38 92% 50%",
  "chart-5": "0 84% 58%",
  "sidebar-background": "0 0% 98%",
  "sidebar-foreground": "240 5.3% 26.1%",
  "sidebar-primary": "207 87% 32%",
  "sidebar-primary-foreground": "0 0% 98%",
  "sidebar-accent": "240 4.8% 95.9%",
  "sidebar-accent-foreground": "240 5.9% 10%",
  "sidebar-border": "220 13% 91%",
  "sidebar-ring": "207 87% 32%",
};

const BASE_DARK: ThemeVars = {
  background: "0 0% 12%",
  foreground: "0 0% 83%",
  card: "0 0% 14%",
  "card-foreground": "0 0% 83%",
  popover: "0 0% 14%",
  "popover-foreground": "0 0% 83%",
  primary: "207 87% 24%",
  "primary-foreground": "0 0% 98%",
  secondary: "0 0% 17%",
  "secondary-foreground": "0 0% 83%",
  muted: "0 0% 17%",
  "muted-foreground": "0 0% 53%",
  accent: "0 0% 18%",
  "accent-foreground": "0 0% 90%",
  destructive: "0 84% 60%",
  "destructive-foreground": "0 0% 98%",
  border: "0 0% 20%",
  input: "0 0% 18%",
  ring: "207 87% 24%",
  radius: "0.4rem",
  "chart-1": "207 87% 54%",
  "chart-2": "150 60% 48%",
  "chart-3": "274 80% 70%",
  "chart-4": "38 92% 60%",
  "chart-5": "0 84% 64%",
  "sidebar-background": "0 0% 9%",
  "sidebar-foreground": "0 0% 83%",
  "sidebar-primary": "207 87% 24%",
  "sidebar-primary-foreground": "0 0% 98%",
  "sidebar-accent": "0 0% 16%",
  "sidebar-accent-foreground": "0 0% 95%",
  "sidebar-border": "0 0% 18%",
  "sidebar-ring": "207 87% 24%",
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "mylife",
    name: "mylife",
    description: "The default interface, with light and dark modes.",
    vars: { light: BASE_LIGHT, dark: BASE_DARK },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral gray with a crisp blue accent.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "220 20% 98%",
        foreground: "220 18% 10%",
        card: "0 0% 100%",
        primary: "213 88% 52%",
        ring: "213 88% 52%",
        "sidebar-primary": "213 88% 52%",
        "chart-1": "213 88% 52%",
      },
      dark: {
        ...BASE_DARK,
        background: "220 8% 9%",
        foreground: "210 20% 92%",
        card: "220 8% 12%",
        popover: "220 8% 12%",
        primary: "210 90% 58%",
        ring: "210 90% 58%",
        muted: "220 8% 16%",
        accent: "220 8% 18%",
        border: "220 8% 22%",
        input: "220 8% 18%",
        "sidebar-background": "220 10% 7%",
        "sidebar-accent": "220 8% 15%",
        "sidebar-border": "220 8% 18%",
        "sidebar-primary": "210 90% 58%",
        "chart-1": "210 90% 58%",
        "chart-2": "160 70% 45%",
      },
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Green primary with organic surfaces.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "120 30% 98%",
        foreground: "150 30% 10%",
        card: "0 0% 100%",
        primary: "145 58% 34%",
        ring: "145 58% 34%",
        "sidebar-primary": "145 58% 34%",
        "chart-1": "145 58% 34%",
        "chart-2": "185 70% 38%",
      },
      dark: {
        ...BASE_DARK,
        background: "150 12% 9%",
        foreground: "120 18% 91%",
        card: "150 12% 12%",
        popover: "150 12% 12%",
        primary: "145 58% 42%",
        ring: "145 58% 42%",
        muted: "150 10% 16%",
        accent: "145 18% 18%",
        border: "150 10% 22%",
        input: "150 10% 18%",
        "sidebar-background": "150 14% 7%",
        "sidebar-accent": "150 12% 15%",
        "sidebar-border": "150 10% 18%",
        "sidebar-primary": "145 58% 42%",
        "chart-1": "145 58% 42%",
        "chart-2": "185 70% 45%",
      },
    },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm orange accent for a little more punch.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "28 45% 98%",
        foreground: "24 25% 12%",
        card: "0 0% 100%",
        primary: "18 85% 48%",
        ring: "18 85% 48%",
        "sidebar-primary": "18 85% 48%",
        "chart-1": "18 85% 48%",
        "chart-2": "42 90% 45%",
      },
      dark: {
        ...BASE_DARK,
        background: "20 12% 9%",
        foreground: "30 20% 92%",
        card: "20 12% 12%",
        popover: "20 12% 12%",
        primary: "18 85% 55%",
        ring: "18 85% 55%",
        muted: "20 10% 16%",
        accent: "20 18% 18%",
        border: "20 10% 22%",
        input: "20 10% 18%",
        "sidebar-background": "20 14% 7%",
        "sidebar-accent": "20 12% 15%",
        "sidebar-border": "20 10% 18%",
        "sidebar-primary": "18 85% 55%",
        "chart-1": "18 85% 55%",
        "chart-2": "42 90% 58%",
      },
    },
  },
  {
    id: "amber-minimal",
    name: "Amber Minimal",
    description: "A minimal neutral base with a warm amber action color.",
    vars: {
      light: {
        ...BASE_LIGHT,
        foreground: "0 0% 24%",
        primary: "39 92% 58%",
        "primary-foreground": "0 0% 0%",
        secondary: "240 8% 96%",
        "secondary-foreground": "220 10% 34%",
        muted: "210 20% 98%",
        "muted-foreground": "225 8% 45%",
        accent: "48 100% 94%",
        "accent-foreground": "31 70% 36%",
        border: "225 14% 91%",
        input: "225 14% 91%",
        ring: "39 92% 58%",
        radius: "0.375rem",
        "chart-1": "39 92% 58%",
        "chart-2": "32 65% 49%",
        "chart-3": "27 56% 38%",
        "chart-4": "30 66% 45%",
        "chart-5": "27 56% 36%",
        "sidebar-background": "210 20% 98%",
        "sidebar-foreground": "0 0% 24%",
        "sidebar-primary": "39 92% 58%",
        "sidebar-primary-foreground": "0 0% 0%",
        "sidebar-accent": "48 100% 94%",
        "sidebar-accent-foreground": "31 70% 36%",
        "sidebar-border": "225 14% 91%",
        "sidebar-ring": "39 92% 58%",
      },
      dark: {
        ...BASE_DARK,
        background: "0 0% 12%",
        foreground: "0 0% 88%",
        card: "0 0% 18%",
        "card-foreground": "0 0% 88%",
        popover: "0 0% 18%",
        "popover-foreground": "0 0% 88%",
        primary: "39 92% 58%",
        "primary-foreground": "0 0% 0%",
        secondary: "0 0% 18%",
        "secondary-foreground": "0 0% 88%",
        muted: "0 0% 15%",
        "muted-foreground": "0 0% 70%",
        accent: "27 56% 38%",
        "accent-foreground": "48 94% 82%",
        border: "0 0% 26%",
        input: "0 0% 26%",
        ring: "39 92% 58%",
        radius: "0.375rem",
        "chart-1": "43 92% 67%",
        "chart-2": "32 65% 49%",
        "chart-3": "27 56% 38%",
        "chart-4": "30 66% 45%",
        "chart-5": "27 56% 38%",
        "sidebar-background": "0 0% 9%",
        "sidebar-foreground": "0 0% 88%",
        "sidebar-primary": "39 92% 58%",
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "27 56% 38%",
        "sidebar-accent-foreground": "48 94% 82%",
        "sidebar-border": "0 0% 26%",
        "sidebar-ring": "39 92% 58%",
      },
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Cozy lavender, blue, green, and peach pastels.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "220 23% 95%",
        foreground: "257 18% 38%",
        card: "0 0% 100%",
        "card-foreground": "257 18% 38%",
        popover: "226 16% 84%",
        "popover-foreground": "257 18% 38%",
        primary: "267 84% 62%",
        "primary-foreground": "0 0% 100%",
        secondary: "226 16% 84%",
        "secondary-foreground": "257 18% 38%",
        muted: "220 17% 89%",
        "muted-foreground": "257 14% 48%",
        accent: "199 76% 58%",
        "accent-foreground": "0 0% 100%",
        destructive: "349 70% 50%",
        "destructive-foreground": "0 0% 100%",
        border: "227 15% 78%",
        input: "226 16% 84%",
        ring: "267 84% 62%",
        radius: "0.35rem",
        "chart-1": "267 84% 62%",
        "chart-2": "199 76% 58%",
        "chart-3": "109 58% 40%",
        "chart-4": "35 88% 55%",
        "chart-5": "15 60% 60%",
        "sidebar-background": "220 20% 92%",
        "sidebar-foreground": "257 18% 38%",
        "sidebar-primary": "267 84% 62%",
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "199 76% 58%",
        "sidebar-accent-foreground": "0 0% 100%",
        "sidebar-border": "227 15% 78%",
        "sidebar-ring": "267 84% 62%",
      },
      dark: {
        ...BASE_DARK,
        background: "240 21% 15%",
        foreground: "226 64% 88%",
        card: "240 21% 18%",
        "card-foreground": "226 64% 88%",
        popover: "237 16% 32%",
        "popover-foreground": "226 64% 88%",
        primary: "267 84% 81%",
        "primary-foreground": "240 21% 18%",
        secondary: "237 16% 38%",
        "secondary-foreground": "226 64% 88%",
        muted: "237 18% 22%",
        "muted-foreground": "228 24% 72%",
        accent: "189 71% 73%",
        "accent-foreground": "240 21% 18%",
        destructive: "343 81% 75%",
        "destructive-foreground": "240 21% 18%",
        border: "237 18% 25%",
        input: "237 18% 25%",
        ring: "267 84% 81%",
        radius: "0.35rem",
        "chart-1": "267 84% 81%",
        "chart-2": "189 71% 73%",
        "chart-3": "115 54% 76%",
        "chart-4": "41 86% 75%",
        "chart-5": "23 92% 82%",
        "sidebar-background": "240 23% 12%",
        "sidebar-foreground": "226 64% 88%",
        "sidebar-primary": "267 84% 81%",
        "sidebar-primary-foreground": "240 21% 18%",
        "sidebar-accent": "189 71% 73%",
        "sidebar-accent-foreground": "240 21% 18%",
        "sidebar-border": "237 16% 32%",
        "sidebar-ring": "267 84% 81%",
      },
    },
  },
  {
    id: "darkmatter",
    name: "Darkmatter",
    description: "Deep cosmic surfaces with electric violet and cyan accents.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "230 33% 98%",
        foreground: "240 24% 14%",
        card: "0 0% 100%",
        primary: "258 86% 55%",
        "primary-foreground": "0 0% 100%",
        secondary: "226 32% 92%",
        "secondary-foreground": "240 24% 18%",
        muted: "226 28% 94%",
        "muted-foreground": "235 12% 43%",
        accent: "189 90% 43%",
        "accent-foreground": "0 0% 100%",
        border: "226 24% 86%",
        input: "226 24% 86%",
        ring: "258 86% 55%",
        "chart-1": "258 86% 55%",
        "chart-2": "189 90% 43%",
        "chart-3": "296 72% 56%",
        "chart-4": "36 92% 55%",
        "chart-5": "146 60% 41%",
        "sidebar-background": "230 33% 96%",
        "sidebar-foreground": "240 24% 14%",
        "sidebar-primary": "258 86% 55%",
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "226 32% 92%",
        "sidebar-accent-foreground": "240 24% 18%",
        "sidebar-border": "226 24% 86%",
        "sidebar-ring": "258 86% 55%",
      },
      dark: {
        ...BASE_DARK,
        background: "240 30% 6%",
        foreground: "230 35% 92%",
        card: "242 28% 10%",
        "card-foreground": "230 35% 92%",
        popover: "242 28% 10%",
        "popover-foreground": "230 35% 92%",
        primary: "258 96% 68%",
        "primary-foreground": "240 30% 6%",
        secondary: "244 26% 15%",
        "secondary-foreground": "230 35% 92%",
        muted: "244 24% 13%",
        "muted-foreground": "230 18% 66%",
        accent: "190 95% 56%",
        "accent-foreground": "240 30% 6%",
        border: "244 20% 20%",
        input: "244 20% 20%",
        ring: "258 96% 68%",
        "chart-1": "258 96% 68%",
        "chart-2": "190 95% 56%",
        "chart-3": "296 82% 66%",
        "chart-4": "36 94% 62%",
        "chart-5": "146 68% 50%",
        "sidebar-background": "240 31% 5%",
        "sidebar-foreground": "230 35% 92%",
        "sidebar-primary": "258 96% 68%",
        "sidebar-primary-foreground": "240 30% 6%",
        "sidebar-accent": "244 26% 15%",
        "sidebar-accent-foreground": "230 35% 92%",
        "sidebar-border": "244 20% 18%",
        "sidebar-ring": "258 96% 68%",
      },
    },
  },
  {
    id: "pastel-dreams",
    name: "Pastel Dreams",
    description: "Soft blush, lavender, seafoam, and buttercream tones.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "42 70% 98%",
        foreground: "252 20% 28%",
        card: "0 0% 100%",
        "card-foreground": "252 20% 28%",
        popover: "0 0% 100%",
        "popover-foreground": "252 20% 28%",
        primary: "336 68% 75%",
        "primary-foreground": "252 20% 22%",
        secondary: "166 46% 88%",
        "secondary-foreground": "166 28% 24%",
        muted: "260 60% 96%",
        "muted-foreground": "252 10% 50%",
        accent: "260 70% 88%",
        "accent-foreground": "260 30% 28%",
        border: "260 36% 88%",
        input: "260 36% 88%",
        ring: "336 68% 75%",
        radius: "0.75rem",
        "chart-1": "336 68% 75%",
        "chart-2": "166 46% 62%",
        "chart-3": "260 70% 72%",
        "chart-4": "44 88% 72%",
        "chart-5": "204 70% 75%",
        "sidebar-background": "260 60% 97%",
        "sidebar-foreground": "252 20% 28%",
        "sidebar-primary": "336 68% 75%",
        "sidebar-primary-foreground": "252 20% 22%",
        "sidebar-accent": "166 46% 88%",
        "sidebar-accent-foreground": "166 28% 24%",
        "sidebar-border": "260 36% 88%",
        "sidebar-ring": "336 68% 75%",
      },
      dark: {
        ...BASE_DARK,
        background: "252 27% 12%",
        foreground: "250 70% 92%",
        card: "252 24% 16%",
        "card-foreground": "250 70% 92%",
        popover: "252 24% 16%",
        "popover-foreground": "250 70% 92%",
        primary: "323 54% 70%",
        "primary-foreground": "252 27% 12%",
        secondary: "166 28% 28%",
        "secondary-foreground": "166 52% 86%",
        muted: "252 22% 20%",
        "muted-foreground": "250 22% 72%",
        accent: "264 46% 62%",
        "accent-foreground": "252 27% 12%",
        border: "252 18% 24%",
        input: "252 18% 24%",
        ring: "323 54% 70%",
        radius: "0.75rem",
        "chart-1": "323 54% 70%",
        "chart-2": "166 44% 58%",
        "chart-3": "264 46% 68%",
        "chart-4": "44 82% 68%",
        "chart-5": "204 66% 70%",
        "sidebar-background": "252 30% 10%",
        "sidebar-foreground": "250 70% 92%",
        "sidebar-primary": "323 54% 70%",
        "sidebar-primary-foreground": "252 27% 12%",
        "sidebar-accent": "252 22% 20%",
        "sidebar-accent-foreground": "250 70% 92%",
        "sidebar-border": "252 18% 22%",
        "sidebar-ring": "323 54% 70%",
      },
    },
  },
  {
    id: "nature",
    name: "Nature",
    description: "Leafy greens and warm earth tones for a calmer dashboard.",
    vars: {
      light: {
        ...BASE_LIGHT,
        background: "95 38% 97%",
        foreground: "130 24% 16%",
        card: "88 44% 99%",
        "card-foreground": "130 24% 16%",
        popover: "88 44% 99%",
        "popover-foreground": "130 24% 16%",
        primary: "132 42% 34%",
        "primary-foreground": "90 50% 98%",
        secondary: "82 36% 88%",
        "secondary-foreground": "124 22% 24%",
        muted: "85 32% 92%",
        "muted-foreground": "120 12% 43%",
        accent: "34 58% 75%",
        "accent-foreground": "30 32% 20%",
        border: "88 26% 82%",
        input: "88 26% 82%",
        ring: "132 42% 34%",
        radius: "0.5rem",
        "chart-1": "132 42% 34%",
        "chart-2": "82 46% 42%",
        "chart-3": "34 58% 48%",
        "chart-4": "174 42% 38%",
        "chart-5": "22 48% 42%",
        "sidebar-background": "95 38% 95%",
        "sidebar-foreground": "130 24% 16%",
        "sidebar-primary": "132 42% 34%",
        "sidebar-primary-foreground": "90 50% 98%",
        "sidebar-accent": "82 36% 88%",
        "sidebar-accent-foreground": "124 22% 24%",
        "sidebar-border": "88 26% 82%",
        "sidebar-ring": "132 42% 34%",
      },
      dark: {
        ...BASE_DARK,
        background: "132 24% 8%",
        foreground: "96 28% 90%",
        card: "132 22% 12%",
        "card-foreground": "96 28% 90%",
        popover: "132 22% 12%",
        "popover-foreground": "96 28% 90%",
        primary: "132 42% 52%",
        "primary-foreground": "132 24% 8%",
        secondary: "118 20% 18%",
        "secondary-foreground": "96 28% 90%",
        muted: "132 18% 16%",
        "muted-foreground": "96 14% 68%",
        accent: "34 58% 58%",
        "accent-foreground": "132 24% 8%",
        border: "132 14% 22%",
        input: "132 14% 22%",
        ring: "132 42% 52%",
        radius: "0.5rem",
        "chart-1": "132 42% 52%",
        "chart-2": "82 46% 58%",
        "chart-3": "34 58% 58%",
        "chart-4": "174 42% 52%",
        "chart-5": "22 48% 58%",
        "sidebar-background": "132 26% 7%",
        "sidebar-foreground": "96 28% 90%",
        "sidebar-primary": "132 42% 52%",
        "sidebar-primary-foreground": "132 24% 8%",
        "sidebar-accent": "118 20% 18%",
        "sidebar-accent-foreground": "96 28% 90%",
        "sidebar-border": "132 14% 20%",
        "sidebar-ring": "132 42% 52%",
      },
    },
  },
];

function varsForMode(bundle: ThemeBundle, mode: ThemeMode): ThemeVars {
  return bundle[mode] ?? bundle.dark ?? bundle.light ?? BASE_DARK;
}

export function applyThemeVars(vars: ThemeVars, mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  root.style.colorScheme = mode;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(`--${key}`, value);
    if (key === "sidebar-background") {
      root.style.setProperty("--sidebar", value);
    }
  }
}

export function saveTheme(id: string, bundle?: ThemeBundle): void {
  localStorage.setItem(THEME_ID_KEY, id);
  if (bundle) {
    localStorage.setItem(THEME_CUSTOM_KEY, JSON.stringify(bundle));
  } else if (id !== "custom") {
    localStorage.removeItem(THEME_CUSTOM_KEY);
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_MODE_KEY, mode);
}

export function applyAndSaveTheme(
  id: string,
  bundle: ThemeBundle,
  mode = loadSavedThemeMode(),
): void {
  applyThemeVars(varsForMode(bundle, mode), mode);
  saveTheme(id, id === "custom" ? bundle : undefined);
  saveThemeMode(mode);
}

export function loadSavedThemeId(): string {
  const saved = localStorage.getItem(THEME_ID_KEY);
  return saved === LEGACY_DEFAULT_THEME_ID ? THEME_PRESETS[0].id : saved ?? THEME_PRESETS[0].id;
}

export function loadSavedThemeMode(): ThemeMode {
  return localStorage.getItem(THEME_MODE_KEY) === "light" ? "light" : "dark";
}

export function loadCustomTheme(): ThemeBundle | null {
  const raw = localStorage.getItem(THEME_CUSTOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ThemeBundle | ThemeVars;
    if ("light" in parsed || "dark" in parsed) return parsed as ThemeBundle;
    return { dark: parsed as ThemeVars };
  } catch {
    return null;
  }
}

export function applySavedTheme(): void {
  const id = loadSavedThemeId();
  const mode = loadSavedThemeMode();
  if (id === "custom") {
    const custom = loadCustomTheme();
    if (custom) {
      applyThemeVars(varsForMode(custom, mode), mode);
      return;
    }
  }
  const preset = THEME_PRESETS.find((theme) => theme.id === id) ?? THEME_PRESETS[0];
  applyThemeVars(varsForMode(preset.vars, mode), mode);
}

function parseThemeVars(input: string): ThemeVars {
  const vars: ThemeVars = {};
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  for (const match of input.matchAll(re)) {
    const key = match[1] === "sidebar" ? "sidebar-background" : match[1];
    vars[key] = match[2].trim();
  }
  return vars;
}

function extractBlock(input: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = input.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  return match?.[1] ?? null;
}

export function parseThemeBundle(input: string): ThemeBundle {
  const lightBlock = extractBlock(input, ":root");
  const darkBlock = extractBlock(input, ".dark");
  if (lightBlock || darkBlock) {
    return {
      ...(lightBlock ? { light: parseThemeVars(lightBlock) } : {}),
      ...(darkBlock ? { dark: parseThemeVars(darkBlock) } : {}),
    };
  }
  const vars = parseThemeVars(input);
  return { light: vars, dark: vars };
}

function blockCss(selector: string, vars: ThemeVars): string {
  const lines = Object.entries(vars)
    .flatMap(([key, value]) =>
      key === "sidebar-background"
        ? [`    --sidebar: ${value};`, `    --${key}: ${value};`]
        : [`    --${key}: ${value};`],
    )
    .join("\n");
  return `${selector} {\n${lines}\n}`;
}

export function themeCss(bundle: ThemeBundle): string {
  const parts: string[] = [];
  if (bundle.light) parts.push(blockCss(":root", bundle.light));
  if (bundle.dark) parts.push(blockCss(".dark", bundle.dark));
  return parts.join("\n\n");
}

export function themeVarsForMode(bundle: ThemeBundle, mode: ThemeMode): ThemeVars {
  return varsForMode(bundle, mode);
}
