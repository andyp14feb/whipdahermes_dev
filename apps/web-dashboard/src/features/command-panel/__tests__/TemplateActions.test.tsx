import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateActions } from "../TemplateActions";
import { DEFAULT_TEMPLATE_ACTIONS, useSettingsStore } from "../../../shared/state/settingsStore";
import { server } from "../../../__tests__/setup";

const postResponse = {
  command_id: "cmd-1",
  state: "accepted",
  target: "machine-1/session-1",
};

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("TemplateActions", () => {
  beforeEach(() => {
    server.resetHandlers();
    useSettingsStore.setState({ templateActions: DEFAULT_TEMPLATE_ACTIONS });
  });

  it("renders all 5 template action buttons", () => {
    renderWithClient(
      <TemplateActions machineId="m-1" sessionId="s-1" />,
    );

    expect(screen.getByRole("button", { name: "yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "continue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "skip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "explain" })).toBeInTheDocument();
  });

  it("calls POST /command on button click", async () => {
    const user = userEvent.setup();
    let postedBody: unknown;
    server.use(
      http.post("/command", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json(postResponse);
      }),
    );

    const onCommandSent = vi.fn();
    renderWithClient(
      <TemplateActions
        machineId="m-1"
        sessionId="s-1"
        onCommandSent={onCommandSent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "yes" }));

    expect(postedBody).toEqual({
      machine_id: "m-1",
      session_id: "s-1",
      payload: "yes",
    });
    expect(onCommandSent).toHaveBeenCalledWith("cmd-1", "yes");
  });

  it("disables buttons during loading", async () => {
    let resolveRequest!: () => void;
    const requestPromise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    server.use(
      http.post("/command", async () => {
        await requestPromise;
        return HttpResponse.json(postResponse);
      }),
    );

    const user = userEvent.setup();
    renderWithClient(
      <TemplateActions machineId="m-1" sessionId="s-1" />,
    );

    const yesBtn = screen.getByRole("button", { name: "yes" });
    user.click(yesBtn);

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => expect(btn).toBeDisabled());
    });

    resolveRequest();
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => expect(btn).toBeEnabled());
    });
  });

  it("shows error text on API failure", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/command", () =>
        HttpResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid payload" } },
          { status: 400 },
        ),
      ),
    );

    renderWithClient(
      <TemplateActions machineId="m-1" sessionId="s-1" />,
    );

    await user.click(screen.getByRole("button", { name: "yes" }));

    expect(await screen.findByText("Invalid payload")).toBeInTheDocument();
  });
});
