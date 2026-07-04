import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { MachineList } from "../features/machine-list/MachineList";
import { SessionPreview } from "../features/session-preview/SessionPreview";
import { StatusBadge } from "../features/status-summary/StatusBadge";
import { useAppStore } from "../shared/state/appStore";
import { useSettingsStore } from "../shared/state/settingsStore";
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

function selectSessionInFirstWindow() {
  useAppStore.setState({
    selectedMachineId: "machine-1",
    selectedSessionId: "session-1",
    connectionError: null,
    windows: [
      { machineId: "machine-1", sessionId: "session-1", heightPx: 480 },
      { machineId: null, sessionId: null, heightPx: 480 },
      { machineId: null, sessionId: null, heightPx: 480 },
      { machineId: null, sessionId: null, heightPx: 480 },
    ],
    activeWindowIndex: 0,
    layoutCount: 1,
  });
}

beforeEach(() => {
  useAppStore.setState({
    selectedMachineId: null,
    selectedSessionId: null,
    connectionError: null,
    connectionFailureCount: 0,
    windows: [
      { machineId: null, sessionId: null, heightPx: 480 },
      { machineId: null, sessionId: null, heightPx: 480 },
      { machineId: null, sessionId: null, heightPx: 480 },
      { machineId: null, sessionId: null, heightPx: 480 },
    ],
    activeWindowIndex: 0,
    layoutCount: 1,
  });
  localStorage.removeItem("whipai-settings");
  localStorage.removeItem("whipai.machineList.manualOrder");
  vi.restoreAllMocks();

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

    await waitFor(() => {
      expect(screen.queryByText("Loading machines...")).not.toBeInTheDocument();
    });

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Frontend Agent")).toBeInTheDocument();
    expect(screen.getByText("API Agent")).toBeInTheDocument();
  });

  it("queues a new tmux session request with prompted or generated name", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("new-agent");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    server.use(
      http.post("/command", async ({ request }) => {
        const body = (await request.json()) as { machine_id: string; session_id: string; payload: string };
        expect(body).toEqual({
          machine_id: "machine-1",
          session_id: "new-agent",
          payload: "__whipai__:create_session:new-agent",
        });
        return HttpResponse.json({ command_id: "cmd-create", state: "accepted", target: "machine-1/new-agent" });
      }),
    );

    renderWithClient(<MachineList />);
    await user.click(await screen.findByRole("button", { name: "New tmux" }));

    expect(promptSpy).toHaveBeenCalledWith("New tmux session name (blank for default)", "");
    expect(alertSpy).toHaveBeenCalledWith(
      "Create tmux session request queued (cmd-create). The next heartbeat confirms registration.",
    );
  });

  it("confirms machine delete as list-only removal that may reappear on heartbeat", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithClient(<MachineList />);
    const removeButtons = await screen.findAllByTitle("Remove machine from list");
    await user.click(removeButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove machine "machine-1" from the displayed list only? This does not stop machine-agent or kill tmux sessions. It may reappear on the next heartbeat.',
    );
  });

  it("updates the store when a session is clicked", async () => {
    const user = userEvent.setup();
    renderWithClient(<MachineList />);

    await user.click(await screen.findByRole("button", { name: /frontend agent/i }));

    expect(useAppStore.getState().selectedMachineId).toBe("machine-1");
    expect(useAppStore.getState().selectedSessionId).toBe("session-1");
  });

  it("sorts machine cards by name and direction", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/machines", () => HttpResponse.json({
        machines: [
          { machine_id: "beta", display_name: "Beta", last_seen_at: "2026-06-26T10:00:00Z", session_count: 0, is_stale: false },
          { machine_id: "alpha", display_name: "Alpha", last_seen_at: "2026-06-26T11:00:00Z", session_count: 0, is_stale: false },
        ],
      })),
      http.get("/sessions", () => HttpResponse.json({ sessions: [] })),
    );

    renderWithClient(<MachineList />);
    await user.click(await screen.findByRole("button", { name: "Name" }));

    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Alpha(0)",
      "Beta(0)",
    ]);

    await user.click(screen.getByRole("button", { name: /asc/i }));

    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Beta(0)",
      "Alpha(0)",
    ]);
  });

  it("sorts machine cards by last registered time", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/machines", () => HttpResponse.json({
        machines: [
          { machine_id: "new", display_name: "New", last_seen_at: "2026-06-26T12:00:00Z", session_count: 0, is_stale: false },
          { machine_id: "old", display_name: "Old", last_seen_at: "2026-06-26T09:00:00Z", session_count: 0, is_stale: false },
        ],
      })),
      http.get("/sessions", () => HttpResponse.json({ sessions: [] })),
    );

    renderWithClient(<MachineList />);
    await user.click(await screen.findByRole("button", { name: "Last registered" }));

    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Old(0)",
      "New(0)",
    ]);

    await user.click(screen.getByRole("button", { name: /asc/i }));

    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "New(0)",
      "Old(0)",
    ]);
  });

  it("allows dragging machine cards into a manual order and persists it", async () => {
    server.use(
      http.get("/machines", () => HttpResponse.json({
        machines: [
          { machine_id: "alpha", display_name: "Alpha", last_seen_at: "2026-06-26T09:00:00Z", session_count: 0, is_stale: false },
          { machine_id: "beta", display_name: "Beta", last_seen_at: "2026-06-26T10:00:00Z", session_count: 0, is_stale: false },
          { machine_id: "gamma", display_name: "Gamma", last_seen_at: "2026-06-26T11:00:00Z", session_count: 0, is_stale: false },
        ],
      })),
      http.get("/sessions", () => HttpResponse.json({ sessions: [] })),
    );

    renderWithClient(<MachineList />);
    await screen.findByText("Alpha");

    fireEvent.dragStart(screen.getByTestId("machine-card-gamma"));
    fireEvent.dragOver(screen.getByTestId("machine-card-alpha"));
    fireEvent.dragEnd(screen.getByTestId("machine-card-gamma"));

    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Gamma(0)",
      "Alpha(0)",
      "Beta(0)",
    ]);
    expect(JSON.parse(localStorage.getItem("whipai.machineList.manualOrder") ?? "[]")).toEqual([
      "gamma",
      "alpha",
      "beta",
    ]);
  });

  it("adds session order controls and sorts sessions by name, status, and stable time", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/machines", () => HttpResponse.json({
        machines: [
          { machine_id: "alpha", display_name: "Alpha", last_seen_at: "2026-06-26T09:00:00Z", session_count: 4, is_stale: false },
        ],
      })),
      http.get("/sessions", () => HttpResponse.json({
        sessions: [
          { machine_id: "alpha", session_id: "s1", label: "Zulu", status: "stale", seconds_since_change: 10, last_seen_at: "2026-06-26T09:00:00Z" },
          { machine_id: "alpha", session_id: "s2", label: "Alpha", status: "active", seconds_since_change: 300, last_seen_at: "2026-06-26T09:00:00Z" },
          { machine_id: "alpha", session_id: "s3", label: "Mike", status: "stable", seconds_since_change: 200, last_seen_at: "2026-06-26T09:00:00Z" },
          { machine_id: "alpha", session_id: "s4", label: "Bravo", status: "waiting_input", seconds_since_change: 100, last_seen_at: "2026-06-26T09:00:00Z" },
        ],
      })),
    );

    renderWithClient(<MachineList />);
    const card = await screen.findByTestId("machine-card-alpha");

    expect(screen.getByText("Session order")).toBeInTheDocument();
    const getLabels = () => within(card).getAllByRole("button").map((button) => button.textContent ?? "").filter((text) => ["Zulu", "Alpha", "Mike", "Bravo"].some((label) => text.includes(label))).map((text) => {
      const match = text.match(/(Zulu|Alpha|Mike|Bravo)/);
      return match?.[1] ?? text;
    });

    expect(getLabels()).toEqual(["Zulu", "Alpha", "Mike", "Bravo"]);

    await user.click(screen.getAllByRole("button", { name: "Name" }).at(-1)!);
    expect(getLabels()).toEqual(["Alpha", "Bravo", "Mike", "Zulu"]);

    await user.click(screen.getByRole("button", { name: "Status" }));
    expect(getLabels()).toEqual(["Alpha", "Mike", "Bravo", "Zulu"]);

    await user.click(screen.getByRole("button", { name: "Stable time" }));
    expect(getLabels()).toEqual(["Zulu", "Bravo", "Mike", "Alpha"]);
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
      expect(screen.getAllByText("Frontend Agent").length).toBeGreaterThanOrEqual(1);

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
      expect(screen.getAllByText("Frontend Agent").length).toBeGreaterThanOrEqual(1);
    },
    20000,
  );

  it(
    "keeps cached SessionPreview data visible after polling failure",
    async () => {
      selectSessionInFirstWindow();

      render(<App />);

      expect(await screen.findByText("machine-1/session-1")).toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Frontend Agent" })).toBeInTheDocument();
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

describe("CommandPanel integration", () => {
  it("shows CommandPanel when session is selected", async () => {
    selectSessionInFirstWindow();

    server.use(
      http.post("/command", () =>
        HttpResponse.json({
          command_id: "cmd-1",
          state: "accepted",
          target: "machine-1/session-1",
        }),
      ),
      http.get("/commands/cmd-1", () =>
        HttpResponse.json({
          command_id: "cmd-1",
          state: "delivered",
          target: "machine-1/session-1",
          payload: "yes",
        }),
      ),
    );

    render(<App />);

    expect(await screen.findByText("Command Actions")).toBeInTheDocument();
  });

  it("navigates to settings and shows a worker script using the saved API URL", async () => {
    useSettingsStore.setState({
      workerApiUrl: "http://192.168.18.68:8000",
      refreshIntervalMs: 2500,
      staleTimeoutSeconds: 90,
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Settings" }));
    expect(screen.getByText("Worker Machine Script")).toBeInTheDocument();
    expect(screen.getAllByText(/http:\/\/192\.168\.18\.68:8000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/git clone/)).toBeInTheDocument();
    expect(screen.getByText(/API_URL="http:\/\/192\.168\.18\.68:8000"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Script" })).toBeInTheDocument();
    expect(screen.getByText(/dashboard data fetching/i)).toBeInTheDocument();
  });

  it("sends POST /command and shows pending state on template click", async () => {
    const user = userEvent.setup();
    selectSessionInFirstWindow();

    server.use(
      http.post("/command", () =>
        HttpResponse.json({
          command_id: "cmd-1",
          state: "accepted",
          target: "machine-1/session-1",
        }),
      ),
    );

    render(<App />);

    expect(await screen.findByText("Command Actions")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "yes" }));

    expect(await screen.findByText("pending")).toBeInTheDocument();
  });
});

describe("App", () => {
  it("applies the dark theme to the app shell", async () => {
    useSettingsStore.setState({ themeMode: "dark" });

    render(<App />);

    const main = await screen.findByRole("main");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(main).toHaveAttribute("data-theme", "dark");
    expect(main).toHaveStyle({ backgroundColor: "rgb(3, 7, 18)" });
    expect(document.body).toHaveStyle({ backgroundColor: "rgb(3, 7, 18)" });
  });

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
