import type {
  ChangeEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface InputProps {
  value: string;
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  type?: string;
  rows?: number;
}

const baseClasses =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

export function Input({
  value,
  onChange,
  placeholder,
  disabled,
  className = "",
  type = "text",
  rows = 1,
}: InputProps) {
  const classes = `${baseClasses} ${className}`;

  if (type === "textarea" || rows > 1) {
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={classes}
        rows={rows}
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={classes}
    />
  );
}
