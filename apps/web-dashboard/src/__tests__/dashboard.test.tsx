import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { MachineList } from "../features/machine-list/MachineList";
import { SessionPreview } from "../features/session-preview/SessionPreview";
import { StatusBadge } from "../features/status-summary/StatusBadge";
import { useAppStore } from "../shared/state/appStore";
import { server } from "./setup";

const machinesResponse = {
  machines: [
    {
      machine_id: "machine-1",
      display_name: "Alpha",
      last_seen_at: "2026-06-26T10:00:00Z",
      session_count: 2,
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
      machine_id: "machine-1",
      session_id: "session-2",
      label: "API Agent",
      status: "waiting",
      seconds_since_change: 125,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
  ],
};

const sessionDetailResponse = {
  machine_id: "machine-1",
  session_id: "session-1",
  label: "Frontend Agent",
  status: "active",
  seconds_since_change: 45,
  preview: "npm run dev\nserver ready",
  cwd: "/workspace/frontend",
  last_seen_at: "2026-06-26T10:00:00Z",
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
  });

  server.use(
    http.get("/machines", () => HttpResponse.json(machinesResponse)),
    http.get("/sessions", () => HttpResponse.json(sessionsResponse)),
    http.get("/sessions/:machineId/:sessionId", () =>
      HttpResponse.json(sessionDetailResponse),
    ),
  );
});

describe("MachineList", () => {
  it("renders machines and sessions from API data", async () => {
    renderWithClient(<MachineList />);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.getByText("API Agent")).toBeInTheDocument();
  });

  it("updates the store when a session is clicked", async () => {
    const user = userEvent.setup();
    renderWithClient(<MachineList />);

    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));

    expect(useAppStore.getState().selectedMachineId).toBe("machine-1");
    expect(useAppStore.getState().selectedSessionId).toBe("session-1");
  });
});

describe("StatusBadge", () => {
  it("renders the correct color classes for active status", () => {
    render(<StatusBadge status="active" />);

    expect(screen.getByText("active")).toHaveClass("bg-green-100");
    expect(screen.getByText("active")).toHaveClass("text-green-800");
  });
});

describe("SessionPreview", () => {
  it("shows a placeholder when no session is selected", () => {
    renderWithClient(<SessionPreview />);

    expect(
      screen.getByText("Select a session to view details"),
    ).toBeInTheDocument();
  });

  it("renders preview details for the selected session", async () => {
    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    renderWithClient(<SessionPreview />);

    expect(await screen.findByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.getByText("/workspace/frontend")).toBeInTheDocument();
    expect(screen.getByText(/server ready/i)).toBeInTheDocument();
  });
});

describe("Polling refresh behavior", () => {
  it(
    "keeps cached data visible and shows stale indicator after polling failure",
    async () => {
      render(<App />);

      expect(await screen.findByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Frontend Agent")).toBeInTheDocument();

      server.use(
        http.get("/machines", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Backend unavailable" } },
            { status: 503 },
          ),
        ),
        http.get("/sessions", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Backend unavailable" } },
            { status: 503 },
          ),
        ),
      );

      expect(await screen.findByText(/connection lost/i, {}, { timeout: 10000 })).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Frontend Agent")).toBeInTheDocument();
    },
    20000,
  );

  it(
    "keeps cached SessionPreview data visible after polling failure",
    async () => {
      useAppStore.setState({
        selectedMachineId: "machine-1",
        selectedSessionId: "session-1",
        connectionError: null,
      });

      render(<App />);

      expect(await screen.findByText("Frontend Agent")).toBeInTheDocument();
      expect(await screen.findByText("/workspace/frontend")).toBeInTheDocument();

      server.use(
        http.get("/sessions/:machineId/:sessionId", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Backend unavailable" } },
            { status: 503 },
          ),
        ),
        http.get("/machines", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Backend unavailable" } },
            { status: 503 },
          ),
        ),
        http.get("/sessions", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Backend unavailable" } },
            { status: 503 },
          ),
        ),
      );

      expect(await screen.findByText(/connection lost/i, {}, { timeout: 10000 })).toBeInTheDocument();
      expect(screen.getAllByText("Frontend Agent")).toHaveLength(2);
      expect(screen.getByText("/workspace/frontend")).toBeInTheDocument();
    },
    15000,
  );
});

describe("App", () => {
  it(
    "shows a connection error banner when the backend is unreachable",
    async () => {
      server.use(
        http.get("/machines", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Unable to reach backend server" } },
            { status: 503 },
          ),
        ),
        http.get("/sessions", () =>
          HttpResponse.json(
            { error: { code: "UNAVAILABLE", message: "Unable to reach backend server" } },
            { status: 503 },
          ),
        ),
      );

      render(<App />);

      expect(await screen.findByText(/connection lost/i, {}, { timeout: 10000 })).toBeInTheDocument();
    },
    15000,
  );
});
