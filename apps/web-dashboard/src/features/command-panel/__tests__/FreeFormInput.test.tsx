import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FreeFormInput } from "../FreeFormInput";
import { server } from "../../../__tests__/setup";

const postResponse = {
  command_id: "cmd-ff-1",
  state: "accepted",
  target: "m-1/s-1",
};

function renderWithProviders(ui: ReactNode) {
  return render(<div>{ui}</div>);
}

describe("FreeFormInput", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("renders an input and a Send button", () => {
    renderWithProviders(
      <FreeFormInput machineId="m-1" sessionId="s-1" />,
    );

    expect(
      screen.getByPlaceholderText("Type a custom command..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send" }),
    ).toBeInTheDocument();
  });

  it("disables Send button when input is empty", () => {
    renderWithProviders(
      <FreeFormInput machineId="m-1" sessionId="s-1" />,
    );

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("disables Send button when input is whitespace-only", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <FreeFormInput machineId="m-1" sessionId="s-1" />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "   ");

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("is a controlled component — typing updates the input value", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <FreeFormInput machineId="m-1" sessionId="s-1" />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "hello");

    expect(input).toHaveValue("hello");
  });

  it("calls POST /command on Send click", async () => {
    const user = userEvent.setup();
    let postedBody: unknown;
    server.use(
      http.post("/command", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json(postResponse);
      }),
    );

    const onCommandSent = vi.fn();
    renderWithProviders(
      <FreeFormInput
        machineId="m-1"
        sessionId="s-1"
        onCommandSent={onCommandSent}
      />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "my custom command");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(postedBody).toEqual({
      machine_id: "m-1",
      session_id: "s-1",
      payload: "my custom command",
    });
    expect(onCommandSent).toHaveBeenCalledWith("cmd-ff-1", "my custom command");
  });

  it("clears input on successful send", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/command", () => HttpResponse.json(postResponse)),
    );

    const onCommandSent = vi.fn();
    renderWithProviders(
      <FreeFormInput
        machineId="m-1"
        sessionId="s-1"
        onCommandSent={onCommandSent}
      />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "do something");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("does NOT clear input on error and shows error message", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/command", () =>
        HttpResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid payload" } },
          { status: 400 },
        ),
      ),
    );

    const onCommandSent = vi.fn();
    renderWithProviders(
      <FreeFormInput
        machineId="m-1"
        sessionId="s-1"
        onCommandSent={onCommandSent}
      />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "bad command");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Invalid payload")).toBeInTheDocument();
    expect(input).toHaveValue("bad command");
    expect(onCommandSent).not.toHaveBeenCalled();
  });

  it("disables Send button while sending", async () => {
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
    renderWithProviders(
      <FreeFormInput machineId="m-1" sessionId="s-1" />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "slow command");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Send/ })).toBeDisabled();
    });

    resolveRequest();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    });
  });

  it("sends on Enter key press", async () => {
    const user = userEvent.setup();
    let postedBody: unknown;
    server.use(
      http.post("/command", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json(postResponse);
      }),
    );

    renderWithProviders(
      <FreeFormInput machineId="m-1" sessionId="s-1" />,
    );

    const input = screen.getByPlaceholderText("Type a custom command...");
    await user.type(input, "enter command{Enter}");

    expect(postedBody).toEqual({
      machine_id: "m-1",
      session_id: "s-1",
      payload: "enter command",
    });
  });
});
