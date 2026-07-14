import * as React from "react";
import { cn } from "@/lib/utils";

// A tiny black & white component kit built on Tailwind — no external UI deps.

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-700",
    outline: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
    ghost: "text-neutral-700 hover:bg-neutral-100",
    danger: "border border-neutral-300 bg-white text-red-600 hover:bg-red-50",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-400",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-neutral-800", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-neutral-200 bg-white", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-700",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Score chip: darker as the score rises, staying in the monochrome palette. */
export function ScoreBadge({ score, method }: { score: number; method?: string | null }) {
  const tone =
    score >= 80
      ? "bg-neutral-900 text-white border-neutral-900"
      : score >= 50
      ? "bg-neutral-200 text-neutral-900 border-neutral-300"
      : "bg-white text-neutral-500 border-neutral-300";
  return (
    <span
      title={method ? `Scored via ${method}` : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone
      )}
    >
      {score}/100
      {method === "rule" && <span className="font-normal opacity-70">· rule</span>}
    </span>
  );
}
