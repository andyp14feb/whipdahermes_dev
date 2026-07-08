import { useEffect, useRef } from "react";
import Convert from "ansi-to-html";

interface TerminalViewProps {
  output: string;
  className?: string;
  heightPx?: number;
}

const converter = new Convert({
  colors: {
    0: "#000",
    1: "#e83e8c",
    2: "#28a745",
    3: "#ffc107",
    4: "#007bff",
    5: "#6f42c1",
    6: "#20c997",
    7: "#6c757d",
    8: "#343a40",
    9: "#e83e8c",
    10: "#28a745",
    11: "#ffc107",
    12: "#007bff",
    13: "#6f42c1",
    14: "#20c997",
    15: "#f8f9fa",
  },
  newline: true,
  escapeXML: true,
});

export function TerminalView({ output, className = "", heightPx = 384 }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output]);

  const html = converter.toHtml(output || "");

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded border border-gray-700 bg-[#1e1e1e] p-3 font-mono text-sm leading-relaxed ${className}`}
      style={{ height: `${heightPx}px` }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ color: "#d4d4d4", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
      />
    </div>
  );
}
