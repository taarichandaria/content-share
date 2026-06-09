import { forwardRef } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-paper hover:bg-accent-deep border border-accent hover:border-accent-deep",
  secondary:
    "bg-transparent text-ink border border-ink/30 hover:border-ink hover:bg-paper-deep",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-paper-deep border border-transparent",
  danger:
    "bg-transparent text-accent border border-accent/30 hover:border-accent hover:bg-accent-soft",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
  }
>(function Button({ variant = "primary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "smallcaps inline-flex items-center justify-center gap-1.5 rounded-full transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        size === "sm" ? "px-3.5 py-1.5" : "px-5 py-2.5",
        buttonStyles[variant],
        className
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink-soft focus:outline-none transition-colors",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-ink placeholder:text-ink-faint focus:border-ink-soft focus:outline-none transition-colors resize-none commentary",
        className
      )}
      {...props}
    />
  );
});

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="smallcaps text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-label="loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-line border-t-accent",
        className
      )}
    />
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">
      {children}
    </p>
  );
}
