import { Dialog as KDialog } from "@kobalte/core/dialog";
import type {
  DialogContentProps,
  DialogDescriptionProps,
  DialogOverlayProps,
  DialogTitleProps,
} from "@kobalte/core/dialog";
import type { ComponentProps, ParentComponent, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { cn } from "~/lib/utils";

export const Dialog = KDialog;
export const DialogTrigger = KDialog.Trigger;
export const DialogClose = KDialog.CloseButton;
export const DialogPortal = KDialog.Portal;

type OverlayProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  DialogOverlayProps<T>
>;

export const DialogOverlay = <T extends ValidComponent = "div">(
  props: OverlayProps<T>,
) => {
  const [local, rest] = splitProps(props as OverlayProps, ["class"]);
  return (
    <KDialog.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        local.class,
      )}
      {...rest}
    />
  );
};

type ContentProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  DialogContentProps<T>
> & { children?: any };

export const DialogContent = <T extends ValidComponent = "div">(
  props: ContentProps<T>,
) => {
  const [local, rest] = splitProps(props as ContentProps, [
    "class",
    "children",
  ]);
  return (
    <DialogPortal>
      <DialogOverlay />
      <KDialog.Content
        class={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg duration-150 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 sm:rounded-lg",
          local.class,
        )}
        {...rest}
      >
        {local.children}
        <KDialog.CloseButton class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          ×
          <span class="sr-only">Close</span>
        </KDialog.CloseButton>
      </KDialog.Content>
    </DialogPortal>
  );
};

export const DialogHeader: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        local.class,
      )}
      {...rest}
    />
  );
};

export const DialogFooter: ParentComponent<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        local.class,
      )}
      {...rest}
    />
  );
};

type TitleProps<T extends ValidComponent = "h2"> = PolymorphicProps<
  T,
  DialogTitleProps<T>
>;

export const DialogTitle = <T extends ValidComponent = "h2">(
  props: TitleProps<T>,
) => {
  const [local, rest] = splitProps(props as TitleProps, ["class"]);
  return (
    <KDialog.Title
      class={cn(
        "text-lg font-semibold leading-none tracking-tight",
        local.class,
      )}
      {...rest}
    />
  );
};

type DescriptionProps<T extends ValidComponent = "p"> = PolymorphicProps<
  T,
  DialogDescriptionProps<T>
>;

export const DialogDescription = <T extends ValidComponent = "p">(
  props: DescriptionProps<T>,
) => {
  const [local, rest] = splitProps(props as DescriptionProps, ["class"]);
  return (
    <KDialog.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
};
