import { useAppStore } from "../../shared/state/appStore";
import { Button } from "../../shared/ui/Button";

const COLUMN_OPTIONS = [1, 2] as const;

export function LayoutSelector() {
  const windowColumnCount = useAppStore((s) => s.windowColumnCount);
  const setWindowColumnCount = useAppStore((s) => s.setWindowColumnCount);
  const addWindow = useAppStore((s) => s.addWindow);
  const windows = useAppStore((s) => s.windows);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Columns:</span>
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
        {COLUMN_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            aria-pressed={windowColumnCount === count}
            onClick={() => setWindowColumnCount(count)}
            style={windowColumnCount === count ? { backgroundColor: "var(--theme-primary)" } : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              windowColumnCount === count
                ? "text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {count} {count === 1 ? "column" : "columns"}
          </button>
        ))}
      </div>
      <Button type="button" variant="secondary" className="px-3 py-1.5 text-sm" onClick={addWindow}>
        Add window
      </Button>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {windows.length} {windows.length === 1 ? "window" : "windows"}
      </span>
    </div>
  );
}
