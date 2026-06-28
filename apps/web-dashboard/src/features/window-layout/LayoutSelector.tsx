import { useAppStore } from "../../shared/state/appStore";

const LAYOUT_OPTIONS = [1, 2, 4] as const;

export function LayoutSelector() {
  const layoutCount = useAppStore((s) => s.layoutCount);
  const setLayoutCount = useAppStore((s) => s.setLayoutCount);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600">Layout:</span>
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
        {LAYOUT_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => setLayoutCount(count)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              layoutCount === count
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}
