import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAppStore } from "../shared/state/appStore";
import { MachineList } from "../features/machine-list/MachineList";
import { SessionPreview } from "../features/session-preview/SessionPreview";
import { server } from "./setup";

const multiMachineMachines = {
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

const multiMachineSessions = {
  sessions: [
    {
      machine_id: "machine-1",
      session_id: "session-a",
      label: "Frontend Agent",
      status: "active",
      seconds_since_change: 10,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
    {
      machine_id: "machine-1",
      session_id: "session-b",
      label: "Build Agent",
      status: "stable",
      seconds_since_change: 30,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
    {
      machine_id: "machine-2",
      session_id: "session-c",
      label: "Data Agent",
      status: "waiting",
      seconds_since_change: 120,
      last_seen_at: "2026-06-26T10:00:00Z",
    },
  ],
};

const sessionADetail = {
  machine_id: "machine-1",
  session_id: "session-a",
  label: "Frontend Agent",
  status: "active",
  seconds_since_change: 10,
  preview: "npm run dev\nserver running",
  cwd: "/workspace/frontend",
  last_seen_at: "2026-06-26T10:00:00Z",
};

const sessionCDetail = {
  machine_id: "machine-2",
  session_id: "session-c",
  label: "Data Agent",
  status: "waiting",
  seconds_since_change: 120,
  preview: "SELECT count(*) FROM events",
  cwd: "/workspace/data",
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
    http.get("*/sessions/:machineId/:sessionId", ({ params }) => {
      const { machineId, sessionId } = params as {
        machineId: string;
        sessionId: string;
      };
      if (machineId === "machine-1" && sessionId === "session-a") {
        return HttpResponse.json(sessionADetail);
      }
      if (machineId === "machine-2" && sessionId === "session-c") {
        return HttpResponse.json(sessionCDetail);
      }
      return HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 },
      );
    }),
    http.get("*/machines", () => HttpResponse.json(multiMachineMachines)),
    http.get("*/sessions", () => HttpResponse.json(multiMachineSessions)),
    http.post("*/assess/:machineId/:sessionId", ({ params }) => {
      const { machineId, sessionId } = params as {
        machineId: string;
        sessionId: string;
      };
      if (machineId === "machine-2" && sessionId === "session-c") {
        return HttpResponse.json({
          ...sessionCDetail,
          ai_assessment: "needs attention",
          ai_assessment_reason: "mocked assessment",
        });
      }
      return HttpResponse.json({
        error: { code: "NOT_FOUND", message: "Session not found" },
      }, { status: 404 });
    }),
  );
});

describe("AC2 — Cross-machine session selection", () => {
  it("renders sessions from both machines grouped by machine", async () => {
    renderWithClient(<MachineList />);

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.getByText("Build Agent")).toBeInTheDocument();
    expect(screen.getByText("Data Agent")).toBeInTheDocument();
  });

  it("selecting session from machine A updates appStore correctly", async () => {
    const user = userEvent.setup();
    renderWithClient(<MachineList />);

    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));

    const state = useAppStore.getState();
    expect(state.selectedMachineId).toBe("machine-1");
    expect(state.selectedSessionId).toBe("session-a");
  });

  it("selecting session from machine B switches appStore", async () => {
    const user = userEvent.setup();
    renderWithClient(<MachineList />);

    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));
    expect(useAppStore.getState().selectedSessionId).toBe("session-a");

    await user.click(screen.getByRole("button", { name: /data agent/i }));
    const state = useAppStore.getState();
    expect(state.selectedMachineId).toBe("machine-2");
    expect(state.selectedSessionId).toBe("session-c");
  });

  it("SessionPreview renders machine A detail after selection", async () => {
    const user = userEvent.setup();
    renderWithClient(<><MachineList /><SessionPreview /></>);

    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));

    expect(screen.getAllByText("Frontend Agent").length).toBeGreaterThan(1);
    expect(screen.getByText(/server running/i)).toBeInTheDocument();
    expect(screen.getByText("/workspace/frontend")).toBeInTheDocument();
  });

  it("SessionPreview switches to machine B detail after re-selection", async () => {
    const user = userEvent.setup();
    renderWithClient(<><MachineList /><SessionPreview /></>);

    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));
    expect(await screen.findByText(/server running/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /data agent/i }));

    expect(screen.getByText(/SELECT.*FROM.*events/i)).toBeInTheDocument();
    expect(screen.getAllByText("Data Agent").length).toBeGreaterThan(1);
    expect(screen.getByText("/workspace/data")).toBeInTheDocument();
  });
});
