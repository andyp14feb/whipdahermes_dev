import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

const variantClasses = {
  primary: "hover:opacity-90 theme-ring",
  secondary: "border hover:opacity-90 theme-ring",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClasses[variant]} ${className}`}
      style={
        variant === "primary"
          ? { backgroundColor: "var(--theme-primary)", color: "var(--theme-primary-fg)", ...style }
          : {
              backgroundColor: "var(--theme-bg-soft)",
              borderColor: "var(--theme-border)",
              color: "var(--theme-text)",
              ...style,
            }
      }
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
