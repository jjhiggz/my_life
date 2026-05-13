// Solid port of shadcn/ui's sidebar primitive (originally React).
//
// Faithful to the original visual design (Tailwind classes preserved) but
// streamlined for what higgzlife actually needs:
//   - No mobile Sheet drawer yet (isMobile is hardcoded false)
//   - No tooltip-on-collapsed-icon wrapping
//   - No asChild / Slot polymorphism
//   - No SidebarMenuSub*, SidebarMenuSkeleton, SidebarMenuBadge, SidebarMenuAction
//   - Open/closed state persisted in localStorage (originals use a cookie)
//
// Tailwind v4 syntax in the original (`w-(--var)`, `--spacing(N)`, `outline-hidden`)
// has been translated to v3.4 equivalents.

import {
  type Accessor,
  type Component,
  type ComponentProps,
  type JSX,
  type ParentComponent,
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
  useContext,
} from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const SIDEBAR_STORAGE_KEY = "sidebar_state";
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarState = "expanded" | "collapsed";

type SidebarContextValue = {
  state: Accessor<SidebarState>;
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isMobile: Accessor<boolean>;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return ctx;
}

type SidebarProviderProps = ComponentProps<"div"> & {
  defaultOpen?: boolean;
};

export const SidebarProvider: ParentComponent<SidebarProviderProps> = (
  props,
) => {
  const [local, rest] = splitProps(props, [
    "defaultOpen",
    "class",
    "style",
    "children",
  ]);

  const initialOpen = (() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch {}
    return local.defaultOpen ?? true;
  })();

  const [open, setOpenSignal] = createSignal(initialOpen);
  const isMobile = () => false; // TODO: media-query hook for true mobile behaviour
  const state = createMemo<SidebarState>(() => (open() ? "expanded" : "collapsed"));

  const setOpen = (value: boolean) => {
    setOpenSignal(value);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
    } catch {}
  };

  const toggleSidebar = () => setOpen(!open());

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <SidebarContext.Provider
      value={{ state, open, setOpen, toggleSidebar, isMobile }}
    >
      <div
        data-slot="sidebar-wrapper"
        style={{
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...(local.style as JSX.CSSProperties | undefined),
        }}
        class={cn(
          "group/sidebar-wrapper flex min-h-screen w-full",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </div>
    </SidebarContext.Provider>
  );
};

type SidebarProps = ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

export const Sidebar: ParentComponent<SidebarProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "side",
    "variant",
    "collapsible",
    "class",
    "children",
  ]);
  const { state } = useSidebar();
  const side = () => local.side ?? "left";
  const variant = () => local.variant ?? "sidebar";
  const collapsible = () => local.collapsible ?? "offcanvas";

  return (
    <>
      {collapsible() === "none" ? (
        <div
          data-slot="sidebar"
          class={cn(
            "flex h-full w-[var(--sidebar-width)] flex-col bg-sidebar text-sidebar-foreground",
            local.class,
          )}
          {...rest}
        >
          {local.children}
        </div>
      ) : (
        <div
          class="group peer hidden text-sidebar-foreground md:block"
          data-state={state()}
          data-collapsible={state() === "collapsed" ? collapsible() : ""}
          data-variant={variant()}
          data-side={side()}
          data-slot="sidebar"
        >
          {/* Handles the gap on desktop so the inset doesn't slide under */}
          <div
            data-slot="sidebar-gap"
            class={cn(
              "relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
              "group-data-[collapsible=offcanvas]:w-0",
              "group-data-[side=right]:rotate-180",
              variant() === "floating" || variant() === "inset"
                ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]"
                : "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]",
            )}
          />
          <div
            data-slot="sidebar-container"
            class={cn(
              "fixed inset-y-0 z-10 hidden h-screen w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",
              side() === "left"
                ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
              variant() === "floating" || variant() === "inset"
                ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem+2px)]"
                : "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l",
              local.class,
            )}
            {...rest}
          >
            <div
              data-sidebar="sidebar"
              data-slot="sidebar-inner"
              class="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
            >
              {local.children}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const SidebarTrigger: Component<ComponentProps<"button">> = (props) => {
  const [local, rest] = splitProps(props, ["class", "onClick"]);
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      aria-label="Toggle Sidebar"
      class={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        local.class,
      )}
      onClick={(e) => {
        if (typeof local.onClick === "function") {
          (local.onClick as (e: MouseEvent) => void)(e);
        }
        toggleSidebar();
      }}
      {...rest}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
      <span class="sr-only">Toggle Sidebar</span>
    </button>
  );
};

export const SidebarRail: Component<ComponentProps<"button">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      title="Toggle Sidebar"
      onClick={toggleSidebar}
      class={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
        "group-data-[side=left]:-right-4 group-data-[side=right]:left-0",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        local.class,
      )}
      {...rest}
    />
  );
};

export const SidebarInset: ParentComponent<ComponentProps<"main">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <main
      data-slot="sidebar-inset"
      class={cn(
        "relative flex w-full flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        local.class,
      )}
      {...rest}
    />
  );
};

export const SidebarHeader: ParentComponent<ComponentProps<"div">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      class={cn("flex flex-col gap-2 p-2", local.class)}
      {...rest}
    />
  );
};

export const SidebarFooter: ParentComponent<ComponentProps<"div">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      class={cn("flex flex-col gap-2 p-2", local.class)}
      {...rest}
    />
  );
};

export const SidebarContent: ParentComponent<ComponentProps<"div">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      class={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        local.class,
      )}
      {...rest}
    />
  );
};

export const SidebarGroup: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      class={cn("relative flex w-full min-w-0 flex-col p-2", local.class)}
      {...rest}
    />
  );
};

export const SidebarGroupLabel: ParentComponent<ComponentProps<"div">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      class={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        local.class,
      )}
      {...rest}
    />
  );
};

export const SidebarGroupContent: ParentComponent<ComponentProps<"div">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      class={cn("w-full text-sm", local.class)}
      {...rest}
    />
  );
};

export const SidebarMenu: ParentComponent<ComponentProps<"ul">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      class={cn("flex w-full min-w-0 flex-col gap-1", local.class)}
      {...rest}
    />
  );
};

export const SidebarMenuItem: ParentComponent<ComponentProps<"li">> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      class={cn("group/menu-item relative", local.class)}
      {...rest}
    />
  );
};

export const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type SidebarMenuButtonProps = ComponentProps<"button"> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    isActive?: boolean;
    tooltip?: string;
  };

export const SidebarMenuButton: ParentComponent<SidebarMenuButtonProps> = (
  props,
) => {
  const [local, rest] = splitProps(props, [
    "class",
    "variant",
    "size",
    "isActive",
    "tooltip",
  ]);
  return (
    <button
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={local.size ?? "default"}
      data-active={local.isActive ?? false}
      title={local.tooltip}
      class={cn(
        sidebarMenuButtonVariants({
          variant: local.variant,
          size: local.size,
        }),
        local.class,
      )}
      {...rest}
    />
  );
};
