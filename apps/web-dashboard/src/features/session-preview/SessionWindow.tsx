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
      className={`flex min-h-[30rem] flex-col gap-2 p-2 transition-colors sm:p-3 ${
        isActive
          ? "border-blue-300 bg-white ring-2 ring-blue-300 dark:border-blue-500 dark:bg-gray-900"
          : "bg-gray-50 opacity-80 dark:bg-gray-950 dark:opacity-70"
      }`}
      onClick={() => setActiveWindow(index)}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Window {index + 1}
          </h2>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {window.machineId && window.sessionId
              ? `${window.machineId}/${window.sessionId}`
              : "No session selected"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${
          isActive
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
            : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        }`}>
          {isActive ? "Active" : "Idle"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <SessionPreview
          machineId={window.machineId}
          sessionId={window.sessionId}
        />
        <CommandPanel
          machineId={window.machineId}
          sessionId={window.sessionId}
        />
      </div>
    </Card>
  );
}
