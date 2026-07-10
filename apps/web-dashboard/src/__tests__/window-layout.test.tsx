import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../app/App";
import { LayoutSelector } from "../features/window-layout/LayoutSelector";
import { LAYOUT_STORAGE_KEY, useAppStore } from "../shared/state/appStore";
import { server } from "./setup";
import { http, HttpResponse } from "msw";

const machinesResponse = {
  machines: [
    {
      machine_id: "machine-1",
      display_name: "Alpha",
      last_seen_at: "2026-06-26T10:00:00Z",
      session_count: 2,
    },
    {
      machine_id: "machine-2",
      display_name: "Bravo",
      last_seen_at: "2026-06-26T10:00:00Z",
      session_count: 1,
    },
  ],
};

const sessionsResponse = {
  sessions: [
    {
      machine_id: "machine-1",
      session_id: "session-1",
      label: "Frontend Agent",
      status: "active",
      seconds_since_change: 45,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
    {
      machine_id: "machine-2",
      session_id: "session-2",
      label: "API Agent",
      status: "waiting",
      seconds_since_change: 125,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
  ],
};

const sessionDetails = {
  "session-1": {
    machine_id: "machine-1",
    session_id: "session-1",
    label: "Frontend Agent",
    status: "active",
    seconds_since_change: 45,
    preview: "npm run dev\nserver ready",
    cwd: "/workspace/frontend",
    last_seen_at: "2026-06-26T10:00:00Z",
  },
  "session-2": {
    machine_id: "machine-2",
    session_id: "session-2",
    label: "API Agent",
    status: "waiting",
    seconds_since_change: 125,
    preview: "curl /health",
    cwd: "/workspace/api",
    last_seen_at: "2026-06-26T10:00:00Z",
  },
};

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  useAppStore.setState({
    selectedMachineId: null,
    selectedSessionId: null,
    connectionError: null,
    connectionFailureCount: 0,
    windows: [{ machineId: null, sessionId: null, heightPx: 480 }],
    activeWindowIndex: 0,
    windowColumnCount: 1,
    leftPanelVisible: true,
    leftPanelWidthPx: 320,
    setSelectedSession: useAppStore.getState().setSelectedSession,
    setWindowSelection: useAppStore.getState().setWindowSelection,
    clearSelection: useAppStore.getState().clearSelection,
    clearWindowSelection: useAppStore.getState().clearWindowSelection,
    setWindowHeight: useAppStore.getState().setWindowHeight,
    addWindow: useAppStore.getState().addWindow,
    removeWindow: useAppStore.getState().removeWindow,
    setWindowColumnCount: useAppStore.getState().setWindowColumnCount,
    setLeftPanelVisible: useAppStore.getState().setLeftPanelVisible,
    setLeftPanelWidth: useAppStore.getState().setLeftPanelWidth,
    setConnectionError: useAppStore.getState().setConnectionError,
    recordConnectionFailure: useAppStore.getState().recordConnectionFailure,
    recordConnectionSuccess: useAppStore.getState().recordConnectionSuccess,
    setActiveWindow: useAppStore.getState().setActiveWindow,
  });

  server.use(
    http.get("*/machines", () => HttpResponse.json(machinesResponse)),
    http.get("*/sessions", () => HttpResponse.json(sessionsResponse)),
    http.get("*/sessions/:machineId/:sessionId", ({ params }) => {
      const { sessionId } = params as Record<string, string>;
      return HttpResponse.json(
        sessionDetails[sessionId as keyof typeof sessionDetails] ?? { error: "not found" },
      );
    }),
  );
});

describe("LayoutSelector", () => {
  it("switches between one and two window columns", async () => {
    const user = userEvent.setup();
    renderWithClient(<LayoutSelector />);

    await user.click(screen.getByRole("button", { name: "2 columns" }));

    expect(useAppStore.getState().windowColumnCount).toBe(2);
  });

  it("adds windows dynamically instead of selecting a fixed 1/2/4 layout", async () => {
    const user = userEvent.setup();
    renderWithClient(<LayoutSelector />);

    await user.click(screen.getByRole("button", { name: "Add window" }));
    await user.click(screen.getByRole("button", { name: "Add window" }));

    expect(useAppStore.getState().windows).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "4" })).not.toBeInTheDocument();
  });
});

describe("Dynamic window dashboard", () => {
  it("renders added windows and arranges them using the selected column count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Add window" }));
    await user.click(screen.getByRole("button", { name: "2 columns" }));

    expect(await screen.findByText("Window 1")).toBeInTheDocument();
    expect(screen.getByText("Window 2")).toBeInTheDocument();
    expect(screen.getByTestId("session-window-grid")).toHaveClass("lg:grid-cols-2");
  }, 30000);

  it("removes non-primary windows from the dashboard", async () => {
    const user = userEvent.setup();
    useAppStore.getState().addWindow();
    render(<App />);

    expect(await screen.findByText("Window 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Window 2" }));

    expect(screen.queryByText("Window 2")).not.toBeInTheDocument();
    expect(useAppStore.getState().windows).toHaveLength(1);
  });

  it("can hide and show the left machine panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByTestId("left-machine-panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide left panel" }));

    expect(screen.queryByTestId("left-machine-panel")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show left panel" }));

    expect(await screen.findByTestId("left-machine-panel")).toBeInTheDocument();
  });

  it("resizes the left machine panel width", async () => {
    render(<App />);

    await screen.findByTestId("left-machine-panel");
    const handle = screen.getByRole("separator", { name: "Resize left machine panel" });
    fireEvent.mouseDown(handle, { clientX: 320 });
    fireEvent.mouseMove(window, { clientX: 460 });
    fireEvent.mouseUp(window);

    expect(useAppStore.getState().leftPanelWidthPx).toBe(460);
    expect(screen.getByTestId("left-machine-panel")).toHaveStyle({ width: "460px" });
  });

  it("renders watched session selector options from machine display names and session labels", async () => {
    render(<App />);

    await screen.findByRole("option", { name: "[Alpha]--[Frontend Agent]" });
    await screen.findByRole("option", { name: "[Bravo]--[API Agent]" });
  });

  it("persists layout settings to localStorage when controls change", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "2 columns" }));
    await user.click(screen.getByRole("button", { name: "Add window" }));
    await user.click(screen.getByRole("button", { name: "Hide left panel" }));

    const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? "{}");
    expect(stored.windowColumnCount).toBe(2);
    expect(stored.windows).toHaveLength(2);
    expect(stored.leftPanelVisible).toBe(false);
  });
});
