import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Convert from "ansi-to-html";

interface TerminalViewProps {
  output: string;
  className?: string;
  heightPx?: number;
  onSelectionHoldChange?: (isHeld: boolean) => void;
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

function selectionIntersectsContainer(container: HTMLElement | null): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !container) {
    return false;
  }

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    if (
      container.contains(range.commonAncestorContainer) ||
      range.intersectsNode(container)
    ) {
      return true;
    }
  }

  return false;
}

export function TerminalView({
  output,
  className = "",
  heightPx = 384,
  onSelectionHoldChange,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectionHeldRef = useRef(false);
  const [displayedOutput, setDisplayedOutput] = useState(output);
  const [isSelectionHeld, setIsSelectionHeld] = useState(false);

  const setSelectionHeld = useCallback((isHeld: boolean) => {
    isSelectionHeldRef.current = isHeld;
    setIsSelectionHeld(isHeld);
  }, []);

  useEffect(() => {
    if (!isSelectionHeldRef.current) {
      setDisplayedOutput(output);
    }
  }, [isSelectionHeld, output]);

  useEffect(() => {
    onSelectionHoldChange?.(isSelectionHeld);
  }, [isSelectionHeld, onSelectionHoldChange]);

  useEffect(() => {
    if (!isSelectionHeld && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedOutput, isSelectionHeld]);

  useEffect(() => {
    const handleSelectionChange = () => {
      setSelectionHeld(selectionIntersectsContainer(containerRef.current));
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [setSelectionHeld]);

  const handlePointerDown = useCallback(() => {
    setSelectionHeld(true);
  }, [setSelectionHeld]);

  const handlePointerUp = useCallback(() => {
    window.setTimeout(() => {
      setSelectionHeld(selectionIntersectsContainer(containerRef.current));
    }, 0);
  }, [setSelectionHeld]);

  const html = useMemo(() => converter.toHtml(displayedOutput || ""), [displayedOutput]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded border border-gray-700 bg-[#1e1e1e] p-3 font-mono text-sm leading-relaxed ${className}`}
      style={{ height: `${heightPx}px` }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ color: "#d4d4d4", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
      />
    </div>
  );
}
