import { ParentComponent, createSignal, onCleanup, onMount } from "solid-js";
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
import TerminalView from "./Terminal";
import ActionPalette from "./components/ActionPalette";
import CommandPalette, { PaletteMode } from "./components/CommandPalette";

type NavItem = { href: string; label: string; icon: string; end?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Agent", icon: "›_", end: true },
  { href: "/plans", label: "Plans", icon: "◐" },
  { href: "/activities", label: "Activities", icon: "▦" },
  { href: "/calendar", label: "Calendar", icon: "◇" },
  { href: "/food", label: "Food", icon: "◍" },
  { href: "/workouts", label: "Workouts", icon: "▲" },
  { href: "/analytics", label: "Analytics", icon: "⌁" },
  { href: "/journal", label: "Journal", icon: "◫" },
  { href: "/settings", label: "Settings", icon: "⚙" },
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
              h
            </div>
            <span class="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              higgzlife
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem>
                    <A
                      href={item.href}
                      end={item.end}
                      title={item.label}
                      class={cn(sidebarMenuButtonVariants())}
                      activeClass="!bg-sidebar-accent !text-sidebar-accent-foreground font-medium"
                    >
                      <span class="w-4 shrink-0 text-center text-sidebar-foreground/80">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </A>
                  </SidebarMenuItem>
                ))}
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
          class="flex flex-1 overflow-hidden"
          style={{ display: onAgent() ? "flex" : "none" }}
        >
          <TerminalView />
        </div>
        {!onAgent() && <div class="min-w-0 flex-1 overflow-auto">{props.children}</div>}
      </SidebarInset>
      <CommandPalette
        mode={paletteMode()}
        open={paletteOpen()}
        tabs={NAV}
        onOpenChange={setPaletteOpen}
        onSelect={(href) => navigate(href)}
      />
      <ActionPalette
        open={actionPaletteOpen()}
        onOpenChange={setActionPaletteOpen}
      />
    </SidebarProvider>
  );
};

export default AppShell;
