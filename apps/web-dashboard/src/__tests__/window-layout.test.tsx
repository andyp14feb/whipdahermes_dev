import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../app/App";
import { LayoutSelector } from "../features/window-layout/LayoutSelector";
import { useAppStore } from "../shared/state/appStore";
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
    {
      machine_id: "machine-3",
      display_name: "Charlie",
      last_seen_at: "2026-06-26T10:00:00Z",
      session_count: 1,
    },
    {
      machine_id: "machine-4",
      display_name: "Delta",
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
    {
      machine_id: "machine-3",
      session_id: "session-3",
      label: "Build Agent",
      status: "stable",
      seconds_since_change: 20,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
    {
      machine_id: "machine-4",
      session_id: "session-4",
      label: "Data Agent",
      status: "stuck",
      seconds_since_change: 305,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
  ],
};

interface SessionDetailResponse {
  machine_id: string;
  session_id: string;
  label: string;
  status: string;
  seconds_since_change: number;
  preview: string;
  cwd: string;
  last_seen_at: string;
}

const sessionDetails: Record<string, SessionDetailResponse> = {
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
  "session-3": {
    machine_id: "machine-3",
    session_id: "session-3",
    label: "Build Agent",
    status: "stable",
    seconds_since_change: 20,
    preview: "npm run build",
    cwd: "/workspace/build",
    last_seen_at: "2026-06-26T10:00:00Z",
  },
  "session-4": {
    machine_id: "machine-4",
    session_id: "session-4",
    label: "Data Agent",
    status: "stuck",
    seconds_since_change: 305,
    preview: "SELECT * FROM events",
    cwd: "/workspace/data",
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
    windows: [
      { machineId: null, sessionId: null },
      { machineId: null, sessionId: null },
      { machineId: null, sessionId: null },
      { machineId: null, sessionId: null },
    ],
    activeWindowIndex: 0,
    layoutCount: 1,
  });

  server.use(
    http.get("/machines", () => HttpResponse.json(machinesResponse)),
    http.get("/sessions", () => HttpResponse.json(sessionsResponse)),
    http.get("/sessions/:machineId/:sessionId", ({ params }) => {
      const { sessionId } = params as Record<string, string>;
      return HttpResponse.json(sessionDetails[sessionId] ?? { error: "not found" });
    }),
  );
});

describe("LayoutSelector", () => {
  it("switches the active layout count", async () => {
    const user = userEvent.setup();
    renderWithClient(<LayoutSelector />);

    await user.click(screen.getByRole("button", { name: "4" }));
    expect(useAppStore.getState().layoutCount).toBe(4);
  });
});

describe("Multi-window dashboard", () => {
  it("renders four tiled windows with independent session state", async () => {
    const user = userEvent.setup();
    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "4" }));
    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));
    await user.click(screen.getByRole("button", { name: "2" }));

    expect(await screen.findByText("Window 1")).toBeInTheDocument();
    expect(screen.getByText("Command Actions")).toBeInTheDocument();
    expect(screen.getByText("Layout:")).toBeInTheDocument();
  });
});
