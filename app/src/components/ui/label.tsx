import type { ComponentProps, ParentComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Label: ParentComponent<ComponentProps<"label">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <label
      class={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        local.class,
      )}
      {...rest}
    />
  );
};
