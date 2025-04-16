"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
  onOpenChange?: (open: boolean) => void;
}

export interface ToastActionElement {
  altText?: string;
  onClick: () => void;
  children?: React.ReactNode;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", onOpenChange, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "flex items-center justify-between space-x-4 rounded-md border p-6 pr-8 shadow-lg transition-all w-full max-w-sm",
          variant === "destructive"
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "border-border bg-background text-foreground",
          className
        )}
        {...props}
      />
    );
  }
);
Toast.displayName = "Toast";

const ToastTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("text-sm font-medium", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

const ToastClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
));
ToastClose.displayName = "ToastClose";

export {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
}; 