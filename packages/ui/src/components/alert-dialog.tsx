import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@mostly/ui/lib/utils";
import * as React from "react";

const AlertDialog = ({ ...props }: AlertDialogPrimitive.Root.Props) => (
  <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
);

const AlertDialogTrigger = ({
  ...props
}: AlertDialogPrimitive.Trigger.Props) => (
  <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
);

const AlertDialogPortal = ({ ...props }: AlertDialogPrimitive.Portal.Props) => (
  <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
);

const AlertDialogBackdrop = ({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) => (
  <AlertDialogPrimitive.Backdrop
    data-slot="alert-dialog-backdrop"
    className={cn(
      "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-black/40 backdrop-blur-xs duration-100",
      className
    )}
    {...props}
  />
);

const AlertDialogContent = ({
  className,
  children,
  ...props
}: AlertDialogPrimitive.Popup.Props) => (
  <AlertDialogPortal>
    <AlertDialogBackdrop />
    <AlertDialogPrimitive.Popup
      data-slot="alert-dialog-content"
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg p-4 shadow-lg ring-1 duration-100 outline-none sm:max-w-md",
        className
      )}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Popup>
  </AlertDialogPortal>
);

const AlertDialogHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="alert-dialog-header"
    className={cn("grid gap-1.5", className)}
    {...props}
  />
);

const AlertDialogFooter = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="alert-dialog-footer"
    className={cn("flex flex-wrap gap-2", className)}
    {...props}
  />
);

const AlertDialogTitle = ({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) => (
  <AlertDialogPrimitive.Title
    data-slot="alert-dialog-title"
    className={cn("text-sm font-medium", className)}
    {...props}
  />
);

const AlertDialogDescription = ({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) => (
  <AlertDialogPrimitive.Description
    data-slot="alert-dialog-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
);

const AlertDialogClose = ({ ...props }: AlertDialogPrimitive.Close.Props) => (
  <AlertDialogPrimitive.Close data-slot="alert-dialog-close" {...props} />
);

export {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
