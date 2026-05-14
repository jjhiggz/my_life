import { Component, ParentComponent, createSignal, onCleanup, onMount } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { cn } from "~/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  sidebarMenuButtonVariants,
} from "~/components/ui/sidebar";
import ActionPalette from "./components/ActionPalette";
import AgentWorkspace from "./components/AgentWorkspace";
import CommandPalette, { PaletteMode } from "./components/CommandPalette";
import TerminalView from "./Terminal";

type IconProps = { class?: string };
type NavItem = { href: string; label: string; icon: Component<IconProps>; end?: boolean };

function iconPath(paths: string[]) {
  return (props: IconProps) => (
    <svg
      class={props.class}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path d={d} />
      ))}
    </svg>
  );
}

const BotIcon = iconPath([
  "M12 8V4H8",
  "M4 14a8 8 0 0 1 16 0v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
  "M9 14h.01",
  "M15 14h.01",
  "M9 18h6",
]);
const ClipboardListIcon = iconPath([
  "M9 5h6",
  "M9 3h6a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2z",
  "M9 12h6",
  "M9 16h6",
]);
const ActivityIcon = iconPath(["M4 12h4l2-6 4 12 2-6h4"]);
const CalendarIcon = iconPath([
  "M8 2v4",
  "M16 2v4",
  "M3 10h18",
  "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
]);
const UtensilsIcon = iconPath([
  "M4 3v8",
  "M8 3v8",
  "M4 7h4",
  "M6 11v10",
  "M18 3v18",
  "M14 3v6a4 4 0 0 0 4 4",
]);
const DumbbellIcon = iconPath([
  "M6 6v12",
  "M18 6v12",
  "M3 9v6",
  "M21 9v6",
  "M6 12h12",
]);
const ChartIcon = iconPath([
  "M4 19V5",
  "M4 19h16",
  "M8 16v-4",
  "M12 16V8",
  "M16 16v-7",
]);
const BookOpenIcon = iconPath([
  "M12 7v14",
  "M4 5a5 5 0 0 1 8 2",
  "M20 5a5 5 0 0 0-8 2",
  "M4 5v13a5 5 0 0 1 8 3",
  "M20 5v13a5 5 0 0 0-8 3",
]);
const SettingsIcon = iconPath([
  "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.06A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.06A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21a2 2 0 1 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15z",
]);

const NAV: NavItem[] = [
  { href: "/", label: "Agents", icon: BotIcon, end: true },
  { href: "/plans", label: "Plans", icon: ClipboardListIcon },
  { href: "/activities", label: "Activities", icon: ActivityIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/food", label: "Food", icon: UtensilsIcon },
  { href: "/workouts", label: "Workouts", icon: DumbbellIcon },
  { href: "/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/journal", label: "Journal", icon: BookOpenIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const ROUTES = NAV.map((n) => n.href);

const AppShell: ParentComponent = (props) => {
  const loc = useLocation();
  const navigate = useNavigate();
  const [paletteMode, setPaletteMode] = createSignal<PaletteMode>("tabs");
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [actionPaletteOpen, setActionPaletteOpen] = createSignal(false);
  const onAgent = () => loc.pathname === "/";
  const currentLabel = () =>
    NAV.find((n) => (n.end ? loc.pathname === n.href : loc.pathname.startsWith(n.href)))
      ?.label ?? "";

  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey && e.shiftKey)) return;
      if (e.code === "KeyR") {
        e.preventDefault();
        window.location.reload();
      } else if (e.code === "KeyP") {
        e.preventDefault();
        setActionPaletteOpen(true);
      } else if (e.code === "BracketRight") {
        e.preventDefault();
        const idx = ROUTES.indexOf(loc.pathname);
        navigate(ROUTES[(idx + 1 + ROUTES.length) % ROUTES.length]);
      } else if (e.code === "BracketLeft") {
        e.preventDefault();
        const idx = ROUTES.indexOf(loc.pathname);
        navigate(ROUTES[(idx - 1 + ROUTES.length) % ROUTES.length]);
      }
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey || e.shiftKey || e.altKey || e.ctrlKey) return;
      if (e.code === "KeyP") {
        e.preventDefault();
        setPaletteMode("tabs");
        setPaletteOpen(true);
      } else if (e.code === "KeyK") {
        e.preventDefault();
        setPaletteMode("activities");
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div class="flex items-center gap-2 px-2 py-1">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
              m
            </div>
            <span class="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              mylife
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                  <SidebarMenuItem>
                    <A
                      href={item.href}
                      end={item.end}
                      title={item.label}
                      class={cn(sidebarMenuButtonVariants())}
                      activeClass="!bg-sidebar-accent !text-sidebar-accent-foreground font-medium"
                    >
                      <Icon class="size-4 shrink-0 text-sidebar-foreground/80" />
                      <span>{item.label}</span>
                    </A>
                  </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div class="px-2 py-1 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            ⌘B to toggle
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          <SidebarTrigger class="-ml-1" />
          <div class="h-4 w-px bg-border" />
          <div class="text-sm font-medium text-foreground/80">{currentLabel()}</div>
        </header>
        <div
          class="flex min-h-0 flex-1 overflow-hidden bg-background"
          style={{ display: onAgent() ? "flex" : "none" }}
        >
          <AgentWorkspace />
        </div>
        {!onAgent() && <div class="min-w-0 flex-1 overflow-auto">{props.children}</div>}
      </SidebarInset>
      <div class="pointer-events-none fixed -left-[10000px] top-0 h-[360px] w-[640px] opacity-0">
        <TerminalView />
      </div>
      <CommandPalette
        mode={paletteMode()}
        open={paletteOpen()}
        tabs={NAV}
        onOpenChange={setPaletteOpen}
        onSelect={(href) => navigate(href)}
      />
      <ActionPalette
        open={actionPaletteOpen()}
        currentPath={loc.pathname}
        onOpenChange={setActionPaletteOpen}
        onViewAgent={() => navigate("/")}
      />
    </SidebarProvider>
  );
};

export default AppShell;
