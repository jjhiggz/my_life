import type { ComponentProps, ParentComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export const Card: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        local.class,
      )}
      {...rest}
    />
  );
};

export const CardHeader: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col space-y-1.5 p-6", local.class)} {...rest} />
  );
};

export const CardTitle: ParentComponent<ComponentProps<"h3">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <h3
      class={cn("font-semibold leading-none tracking-tight", local.class)}
      {...rest}
    />
  );
};

export const CardDescription: ParentComponent<ComponentProps<"p">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <p class={cn("text-sm text-muted-foreground", local.class)} {...rest} />
  );
};

export const CardContent: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return <div class={cn("p-6 pt-0", local.class)} {...rest} />;
};

export const CardFooter: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex items-center p-6 pt-0", local.class)} {...rest} />
  );
};
