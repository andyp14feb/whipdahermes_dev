import { Component, type ReactNode, useEffect, useState } from "react";
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
            ? "text-blue-600 underline underline-offset-4"
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
            ? "text-blue-600 underline underline-offset-4"
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

const GRID_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 2xl:grid-cols-2",
  4: "grid-cols-1 lg:grid-cols-2",
};

function Dashboard() {
  const windows = useAppStore((s) => s.windows);
  const layoutCount = useAppStore((s) => s.layoutCount);

  const visibleWindows = windows.slice(0, layoutCount);

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Monitor machines and tmux sessions from one live view.
        </p>
        <LayoutSelector />
      </header>

      <ConnectionBanner />

      <ErrorBoundary>
        <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="min-h-[30rem]">
            <MachineList />
          </aside>
          <section className="min-h-[30rem]">
            <div className={`grid gap-3 ${GRID_CLASSES[layoutCount]}`}>
              {visibleWindows.map((_, i) => (
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen w-full bg-gray-100 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 sm:p-6">
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
