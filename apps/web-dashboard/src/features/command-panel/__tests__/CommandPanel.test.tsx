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
});
