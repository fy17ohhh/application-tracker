import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button({
  children,
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }>) {
  return (
    <button className={`button button-${variant}`} type="button" {...props}>
      {children}
    </button>
  );
}

export function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
