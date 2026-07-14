import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { MachineList } from "../features/machine-list/MachineList";
import { SessionWindow } from "../features/session-preview/SessionWindow";
import { LayoutSelector } from "../features/window-layout/LayoutSelector";
import { SettingsPage } from "../features/settings/SettingsPage";
import { useAppStore } from "../shared/state/appStore";
import { useSettingsStore } from "../shared/state/settingsStore";
import { applyThemeVariables, getColorTheme, themeToCustomColors } from "../shared/state/colorThemes";
import { Button } from "../shared/ui/Button";
import { formatErrorMessage } from "../shared/api-client/errorEnvelope";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      useAppStore
        .getState()
        .recordConnectionFailure(formatErrorMessage(error) || "Unable to reach backend server");
    },
    onSuccess: () => {
      useAppStore.getState().recordConnectionSuccess();
    },
  }),
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000,
    },
  },
});

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          Unable to render dashboard content.
        </div>
      );
    }

    return this.props.children;
  }
}

function ConnectionBanner() {
  const connectionError = useAppStore((s) => s.connectionError);
  const setConnectionError = useAppStore((s) => s.setConnectionError);

  if (!connectionError) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <span>Connection lost — showing cached data. {connectionError}</span>
      <Button
        type="button"
        variant="secondary"
        className="py-1 text-xs"
        onClick={() => {
          setConnectionError(null);
          void queryClient.invalidateQueries();
        }}
      >
        Retry
      </Button>
    </div>
  );
}

function ThemeToggle() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  return (
    <Button
      type="button"
      variant="secondary"
      className="py-1 text-xs"
      onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
    >
      {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
    </Button>
  );
}

function NavBar({ current, onNavigate }: { current: "dashboard" | "settings"; onNavigate: (view: "dashboard" | "settings") => void }) {
  return (
    <nav className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
      <h1 className="mr-auto text-xl font-bold text-gray-900 dark:text-gray-100">WhipAI</h1>
      <button
        type="button"
        className={`text-sm font-medium ${
          current === "dashboard"
            ? "theme-text underline underline-offset-4"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        }`}
        onClick={() => onNavigate("dashboard")}
      >
        Dashboard
      </button>
      <button
        type="button"
        className={`text-sm font-medium ${
          current === "settings"
            ? "theme-text underline underline-offset-4"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        }`}
        onClick={() => onNavigate("settings")}
      >
        Settings
      </button>
      <ThemeToggle />
    </nav>
  );
}

const WINDOW_GRID_CLASSES: Record<1 | 2, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 lg:grid-cols-2",
};

function Dashboard() {
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const windows = useAppStore((s) => s.windows);
  const windowColumnCount = useAppStore((s) => s.windowColumnCount);
  const leftPanelVisible = useAppStore((s) => s.leftPanelVisible);
  const leftPanelWidthPx = useAppStore((s) => s.leftPanelWidthPx);
  const setLeftPanelVisible = useAppStore((s) => s.setLeftPanelVisible);
  const setLeftPanelWidth = useAppStore((s) => s.setLeftPanelWidth);

  const startLeftPanelResize = (event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if ("pointerId" in event) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    resizeStateRef.current = { startX: event.clientX, startWidth: leftPanelWidthPx };
    const onMove = (moveEvent: PointerEvent | MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      setLeftPanelWidth(resizeState.startWidth + (moveEvent.clientX - resizeState.startX));
    };
    const onUp = () => {
      resizeStateRef.current = null;
      globalThis.window.removeEventListener("pointermove", onMove);
      globalThis.window.removeEventListener("pointerup", onUp);
      globalThis.window.removeEventListener("mousemove", onMove);
      globalThis.window.removeEventListener("mouseup", onUp);
    };
    globalThis.window.addEventListener("pointermove", onMove);
    globalThis.window.addEventListener("pointerup", onUp, { once: true });
    globalThis.window.addEventListener("mousemove", onMove);
    globalThis.window.addEventListener("mouseup", onUp, { once: true });
  };

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitor machines and tmux sessions from one live view.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => setLeftPanelVisible(!leftPanelVisible)}
          >
            {leftPanelVisible ? "Hide left panel" : "Show left panel"}
          </Button>
        </div>
        <LayoutSelector />
      </header>

      <ConnectionBanner />

      <ErrorBoundary>
        <div className="flex min-w-0 gap-3">
          {leftPanelVisible && (
            <div className="flex shrink-0 gap-2" style={{ width: leftPanelWidthPx }}>
              <aside data-testid="left-machine-panel" className="min-h-[30rem] min-w-0 flex-1" style={{ width: leftPanelWidthPx }}>
                <MachineList />
              </aside>
              <div
                role="separator"
                aria-label="Resize left machine panel"
                aria-orientation="vertical"
                tabIndex={0}
                className="w-1.5 cursor-col-resize rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                onPointerDown={startLeftPanelResize}
                onMouseDown={startLeftPanelResize}
              />
            </div>
          )}
          <section className="min-w-0 flex-1">
            <div data-testid="session-window-grid" className={`grid gap-3 ${WINDOW_GRID_CLASSES[windowColumnCount]}`}>
              {windows.map((_, i) => (
                <SessionWindow key={i} index={i} />
              ))}
            </div>
          </section>
        </div>
      </ErrorBoundary>
    </>
  );
}

export function App() {
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");
  const themeMode = useSettingsStore((s) => s.themeMode);
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const customColors = useSettingsStore((s) => s.customColors);
  const hydrateRemoteSettings = useSettingsStore((s) => s.hydrateRemoteSettings);

  useEffect(() => {
    void hydrateRemoteSettings();
  }, [hydrateRemoteSettings]);

  useEffect(() => {
    const isDark = themeMode === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = themeMode;
    document.documentElement.style.backgroundColor = "var(--theme-bg)";
    document.body.style.backgroundColor = "var(--theme-bg)";
    const resolvedColors = colorTheme === "custom" ? customColors : themeToCustomColors(getColorTheme(colorTheme));
    applyThemeVariables(resolvedColors);
    document.body.style.color = "var(--theme-text)";
  }, [themeMode, colorTheme, customColors]);

  useEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme;
  }, [colorTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <main
        data-theme={themeMode}
        className="min-h-screen w-full p-4 sm:p-6"
        style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text)" }}
      >
        <div className="w-full min-w-0">
          <NavBar current={view} onNavigate={setView} />
          {view === "dashboard" && <Dashboard />}
          {view === "settings" && (
            <SettingsPage onClose={() => setView("dashboard")} />
          )}
        </div>
      </main>
    </QueryClientProvider>
  );
}
