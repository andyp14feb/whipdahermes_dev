import { CommandPanel } from "../command-panel/CommandPanel";
import { Card } from "../../shared/ui/Card";
import { SessionPreview } from "../session-preview/SessionPreview";
import { useAppStore } from "../../shared/state/appStore";

interface SessionWindowProps {
  index: number;
}

export function SessionWindow({ index }: SessionWindowProps) {
  const window = useAppStore((s) => s.windows[index]);
  const activeWindowIndex = useAppStore((s) => s.activeWindowIndex);
  const setActiveWindow = useAppStore((s) => s.setActiveWindow);
  const isActive = activeWindowIndex === index;

  return (
    <Card
      className={`flex min-h-[32rem] flex-col gap-4 p-4 ${isActive ? "ring-2 ring-blue-400" : ""}`}
      onClick={() => setActiveWindow(index)}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Window {index + 1}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {window.machineId && window.sessionId
              ? `${window.machineId}/${window.sessionId}`
              : "No session selected"}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {isActive ? "Active" : "Idle"}
        </span>
      </div>
      <div className="grid min-h-0 gap-4 lg:grid-cols-2">
        <div className="min-h-0">
          <SessionPreview
            machineId={window.machineId}
            sessionId={window.sessionId}
          />
        </div>
        <div className="min-h-0">
          <CommandPanel
            machineId={window.machineId}
            sessionId={window.sessionId}
          />
        </div>
      </div>
    </Card>
  );
}
