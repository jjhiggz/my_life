import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import * as SelectPrimitive from "@kobalte/core/select";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { cn } from "~/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectHiddenSelect = SelectPrimitive.HiddenSelect;

type TriggerProps<T extends ValidComponent = "button"> = PolymorphicProps<
  T,
  SelectPrimitive.SelectTriggerProps<T>
> & { class?: string; children?: JSX.Element };

export const SelectTrigger = <T extends ValidComponent = "button">(
  props: TriggerProps<T>,
) => {
  const [local, rest] = splitProps(props as TriggerProps, ["class", "children"]);
  return (
    <SelectPrimitive.Trigger
      class={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <SelectPrimitive.Icon class="ml-2 opacity-50">
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
          <path d="m6 9 6 6 6-6" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
};

type ContentProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  SelectPrimitive.SelectContentProps<T>
> & { class?: string };

export const SelectContent = <T extends ValidComponent = "div">(
  props: ContentProps<T>,
) => {
  const [local, rest] = splitProps(props as ContentProps, ["class"]);
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        class={cn(
          "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          local.class,
        )}
        {...rest}
      >
        <SelectPrimitive.Listbox class="p-1 focus:outline-none" />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
};

type ItemProps<T extends ValidComponent = "li"> = PolymorphicProps<
  T,
  SelectPrimitive.SelectItemProps<T>
> & { class?: string; children?: JSX.Element };

export const SelectItem = <T extends ValidComponent = "li">(
  props: ItemProps<T>,
) => {
  const [local, rest] = splitProps(props as ItemProps, ["class", "children"]);
  return (
    <SelectPrimitive.Item
      class={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemLabel>{local.children}</SelectPrimitive.ItemLabel>
    </SelectPrimitive.Item>
  );
};
