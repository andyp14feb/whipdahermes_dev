import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

const variantClasses = {
  primary: "text-white hover:opacity-90 theme-ring",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:ring-gray-600",
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
      style={variant === "primary" ? { backgroundColor: "var(--theme-primary)", ...style } : style}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
