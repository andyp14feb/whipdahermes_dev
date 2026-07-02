import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
