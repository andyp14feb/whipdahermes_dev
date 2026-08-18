import { useEffect, useState } from "react";

interface IdleTimerProps {
  seconds: number;
}

export function formatIdleTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function IdleTimer({ seconds }: IdleTimerProps) {
  const [display, setDisplay] = useState(() => formatIdleTime(seconds));

  useEffect(() => {
    setDisplay(formatIdleTime(seconds));
  }, [seconds]);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplay((prev) => {
        const match = prev.match(/(\d+)m\s*(\d+)?s?/);
        if (!match) {
          const sMatch = prev.match(/(\d+)s/);
          if (sMatch) {
            const current = parseInt(sMatch[1], 10);
            return formatIdleTime(current + 1);
          }
          return formatIdleTime(seconds + 1);
        }
        const m = parseInt(match[1], 10);
        const s = match[2] ? parseInt(match[2], 10) : 0;
        return formatIdleTime(m * 60 + s + 1);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return <span className="text-xs text-gray-500">{display}</span>;
}
