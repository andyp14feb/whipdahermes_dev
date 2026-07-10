import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "", style, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border shadow-sm transition-colors ${className}`}
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card)', color: 'var(--theme-text)', ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
