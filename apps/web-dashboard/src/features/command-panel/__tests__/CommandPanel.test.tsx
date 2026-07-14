import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPanel } from "../CommandPanel";
import { server } from "../../../__tests__/setup";

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("CommandPanel", () => {
  beforeEach(() => {
    server.resetHandlers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.removeItem("whipai.commandHistory");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows placeholder when no session selected", () => {
    renderWithClient(
      <CommandPanel machineId={null} sessionId={null} />,
    );

    expect(
      screen.getByText("No session selected"),
    ).toBeInTheDocument();
  });

  it("tracks command state transitions pending → accepted → delivered", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    server.use(
      http.post("/command", () =>
        HttpResponse.json({
          command_id: "cmd-1",
          state: "accepted",
          target: "m-1/s-1",
        }),
      ),
    );

    renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );

    await user.click(screen.getByRole("button", { name: "yes" }));

    expect(await screen.findByText("pending")).toBeInTheDocument();

    server.use(
      http.get("/commands/cmd-1", () =>
        HttpResponse.json({
          command_id: "cmd-1",
          state: "delivered",
          target: "m-1/s-1",
          payload: "yes",
          delivered_at: "2026-06-26T12:00:00Z",
        }),
      ),
    );

    await vi.advanceTimersByTimeAsync(2500);

    await waitFor(() => {
      expect(screen.getByText("delivered")).toBeInTheDocument();
    });
  });

  it("loads persisted command history for resend after remount", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const posts: Array<{ machine_id: string; session_id: string; payload: string }> = [];
    window.localStorage.setItem(
      "whipai.commandHistory",
      JSON.stringify([{ id: "persisted-cmd", payload: "restore me", state: "delivered" }]),
    );

    server.use(
      http.post("/command", async ({ request }) => {
        const body = await request.json() as { machine_id: string; session_id: string; payload: string };
        posts.push(body);
        return HttpResponse.json({
          command_id: "cmd-resend",
          state: "accepted",
          target: `${body.machine_id}/${body.session_id}`,
        });
      }),
    );

    renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );

    expect(screen.getByText("Command History")).toBeInTheDocument();
    expect(screen.getByLabelText("Command history list")).toHaveClass("max-h-56", "overflow-y-auto");
    expect(screen.getByText("restore me")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(posts).toEqual([{ machine_id: "m-1", session_id: "s-1", payload: "restore me" }]);
    });
  });

  it("copies a command history payload", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    window.localStorage.setItem(
      "whipai.commandHistory",
      JSON.stringify([{ id: "persisted-cmd", payload: "copy this command", state: "delivered" }]),
    );

    renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("copy this command");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    writeText.mockRestore();
  });

  it("resends a history payload to the current active session", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const posts: Array<{ machine_id: string; session_id: string; payload: string }> = [];

    server.use(
      http.post("/command", async ({ request }) => {
        const body = await request.json() as { machine_id: string; session_id: string; payload: string };
        posts.push(body);
        return HttpResponse.json({
          command_id: `cmd-${posts.length}`,
          state: "accepted",
          target: `${body.machine_id}/${body.session_id}`,
        });
      }),
    );

    const { rerender } = renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );
    await user.click(screen.getByRole("button", { name: "yes" }));
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })}>
        <CommandPanel machineId="m-2" sessionId="s-2" />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(posts).toEqual([
        { machine_id: "m-1", session_id: "s-1", payload: "yes" },
        { machine_id: "m-2", session_id: "s-2", payload: "yes" },
      ]);
    });
  });

  it("shows failure reason in red when command fails", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    server.use(
      http.post("/command", () =>
        HttpResponse.json({
          command_id: "cmd-2",
          state: "accepted",
          target: "m-1/s-1",
        }),
      ),
    );

    renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );

    await user.click(screen.getByRole("button", { name: "retry" }));

    expect(await screen.findByText("pending")).toBeInTheDocument();

    server.use(
      http.get("/commands/cmd-2", () =>
        HttpResponse.json({
          command_id: "cmd-2",
          state: "failed",
          target: "m-1/s-1",
          payload: "retry",
          failure_reason: "Session not found",
        }),
      ),
    );

    await vi.advanceTimersByTimeAsync(2500);

    await waitFor(() => {
      expect(screen.getByText("Session not found")).toBeInTheDocument();
      expect(screen.getByText("Session not found")).toHaveClass("text-red-600");
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("sends machine-agent control command without confirmation when none configured", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    server.use(
      http.post("/command", () =>
        HttpResponse.json({
          command_id: "cmd-start",
          state: "accepted",
          target: "m-1/s-1",
        }),
      ),
    );

    renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );

    await user.click(screen.getByRole("button", { name: "Start updates" }));

    expect(await screen.findByText("Start updates command sent successfully")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("cancels restart action when confirmation is rejected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    server.use(
      http.post("/command", () =>
        HttpResponse.json({
          command_id: "cmd-restart",
          state: "accepted",
          target: "m-1/s-1",
        }),
      ),
    );

    renderWithClient(
      <CommandPanel machineId="m-1" sessionId="s-1" />,
    );

    await user.click(screen.getByRole("button", { name: "Restart service" }));

    expect(confirmSpy).toHaveBeenCalledWith("Restart the machine-agent service?");
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});

