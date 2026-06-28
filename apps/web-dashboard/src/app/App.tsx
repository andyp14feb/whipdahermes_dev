import { Component, type ReactNode, useState } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { MachineList } from "../features/machine-list/MachineList";
import { SessionPreview } from "../features/session-preview/SessionPreview";
import { CommandPanel } from "../features/command-panel/CommandPanel";
import { SettingsPage } from "../features/settings/SettingsPage";
import { useAppStore } from "../shared/state/appStore";
import { Button } from "../shared/ui/Button";
import { formatErrorMessage } from "../shared/api-client/errorEnvelope";

const queryClient = new QueryClient({
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

function NavBar({ current, onNavigate }: { current: "dashboard" | "settings"; onNavigate: (view: "dashboard" | "settings") => void }) {
  return (
    <nav className="mb-6 flex items-center gap-4 border-b border-gray-200 pb-4">
      <h1 className="mr-auto text-2xl font-bold text-gray-900">WhipAI</h1>
      <button
        type="button"
        className={`text-sm font-medium ${
          current === "dashboard"
            ? "text-blue-600 underline underline-offset-4"
            : "text-gray-600 hover:text-gray-900"
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
            : "text-gray-600 hover:text-gray-900"
        }`}
        onClick={() => onNavigate("settings")}
      >
        Settings
      </button>
    </nav>
  );
}

function Dashboard() {
  const selectedMachineId = useAppStore((s) => s.selectedMachineId);
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);

  return (
    <>
      <header className="mb-6">
        <p className="text-sm text-gray-500">
          Monitor machines and tmux sessions from one live view.
        </p>
      </header>

      <ConnectionBanner />

      <ErrorBoundary>
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="min-h-[32rem]">
            <MachineList />
          </aside>
          <section className="min-h-[32rem]">
            <SessionPreview />
            <CommandPanel
              machineId={selectedMachineId}
              sessionId={selectedSessionId}
            />
          </section>
        </div>
      </ErrorBoundary>
    </>
  );
}

export function App() {
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");

  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-7xl">
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
