import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionPreview } from "../SessionPreview";
import { useAppStore } from "../../../shared/state/appStore";
import { server } from "../../../__tests__/setup";

const sessionDetailBase = {
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
      queries: { retry: false, staleTime: 0 },
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
  });
  localStorage.removeItem("whipai-settings");
});

describe("AI assessment display", () => {
  it("does not show assessment badge when ai_assessment is absent", async () => {
    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    server.use(
      http.get("/sessions/:machineId/:sessionId", () =>
        HttpResponse.json(sessionDetailBase),
      ),
    );

    renderWithClient(<SessionPreview />);

    expect(await screen.findByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.queryByText(/ai assessment/i)).not.toBeInTheDocument();
  });

  it("renders ai_assessment badge with label when present", async () => {
    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    server.use(
      http.get("/sessions/:machineId/:sessionId", () =>
        HttpResponse.json({
          ...sessionDetailBase,
          ai_assessment: "stuck",
          ai_assessment_reason: "No output in 60s",
          ai_assessed_at: "2026-06-26T10:01:00Z",
        }),
      ),
    );

    renderWithClient(<SessionPreview />);

    expect(await screen.findByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.getByText("stuck")).toBeInTheDocument();
    expect(screen.getByText("No output in 60s")).toBeInTheDocument();
    expect(screen.getByText("2026-06-26T10:01:00Z")).toBeInTheDocument();
  });

  it("does not render ai_assessed_at when absent", async () => {
    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    server.use(
      http.get("/sessions/:machineId/:sessionId", () =>
        HttpResponse.json({
          ...sessionDetailBase,
          ai_assessment: "running",
        }),
      ),
    );

    renderWithClient(<SessionPreview />);

    expect(await screen.findByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.queryByText(/2026-/)).not.toBeInTheDocument();
  });

  it("shows Assess button when session is loaded", async () => {
    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    server.use(
      http.get("/sessions/:machineId/:sessionId", () =>
        HttpResponse.json(sessionDetailBase),
      ),
    );

    renderWithClient(<SessionPreview />);

    expect(await screen.findByRole("button", { name: /assess/i })).toBeInTheDocument();
  });
});

describe("Assess action", () => {
  it("calls POST /assess when Assess button is clicked and shows result", async () => {
    const user = userEvent.setup();

    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    let assessCalled = false;

    server.use(
      http.get("/sessions/:machineId/:sessionId", () =>
        HttpResponse.json(sessionDetailBase),
      ),
      http.post("/assess/:machineId/:sessionId", () => {
        assessCalled = true;
        return HttpResponse.json({
          machine_id: "machine-1",
          session_id: "session-1",
          ai_assessment: "running",
          ai_assessment_reason: "Building project",
          ai_assessed_at: "2026-06-26T10:02:00Z",
        });
      }),
    );

    renderWithClient(<SessionPreview />);

    expect(await screen.findByRole("button", { name: /assess/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /assess/i }));

    await waitFor(() => {
      expect(screen.getByText("running")).toBeInTheDocument();
    });
    expect(screen.getByText("Building project")).toBeInTheDocument();
    expect(assessCalled).toBe(true);
  });

  it("shows a clear message when assessor returns 503", async () => {
    const user = userEvent.setup();

    useAppStore.setState({
      selectedMachineId: "machine-1",
      selectedSessionId: "session-1",
      connectionError: null,
    });

    server.use(
      http.get("/sessions/:machineId/:sessionId", () =>
        HttpResponse.json(sessionDetailBase),
      ),
      http.post("/assess/:machineId/:sessionId", () =>
        HttpResponse.json(
          {
            error: {
              code: "ASSESSOR_UNAVAILABLE",
              message: "Session assessor is not configured",
            },
          },
          { status: 503 },
        ),
      ),
    );

    renderWithClient(<SessionPreview />);

    expect(await screen.findByRole("button", { name: /assess/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /assess/i }));

    expect(await screen.findByText("AI assessor is not configured yet")).toBeInTheDocument();
    expect(screen.queryByText("AI assessor is not configured yet.")).not.toBeInTheDocument();
  });
});
