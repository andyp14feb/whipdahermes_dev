import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionWindow } from "../SessionWindow";
import { useAppStore } from "../../../shared/state/appStore";
import { useSettingsStore } from "../../../shared/state/settingsStore";
import { server } from "../../../__tests__/setup";

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("SessionWindow", () => {
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
    useSettingsStore.setState({ refreshIntervalMs: 2500 });
    server.resetHandlers();
  });

  it("formats session options as [display_name]--[session_label] using machines map", async () => {
    server.use(
      http.get("*/machines", () =>
        HttpResponse.json({
          machines: [
            { machine_id: "m-zeta", display_name: "Zeta Corp", last_seen_at: "2026-07-03T10:00:00Z", session_count: 1, is_stale: false },
            { machine_id: "m-alpha", display_name: "Alpha HQ", last_seen_at: "2026-07-03T10:00:00Z", session_count: 2, is_stale: false },
            { machine_id: "m-gamma", display_name: "", last_seen_at: "2026-07-03T10:00:00Z", session_count: 1, is_stale: false },
          ],
        }),
      ),
      http.get("*/sessions", () =>
        HttpResponse.json({
          sessions: [
            {
              machine_id: "m-zeta",
              session_id: "sess-beta",
              label: "Zeta Beta",
              status: "active",
              seconds_since_change: 1,
              last_seen_at: "2026-07-03T10:00:00Z",
            },
            {
              machine_id: "m-alpha",
              session_id: "sess-zed",
              label: "Alpha Zed",
              status: "active",
              seconds_since_change: 1,
              last_seen_at: "2026-07-03T10:00:00Z",
            },
            {
              machine_id: "m-gamma",
              session_id: "sess-able",
              label: "",
              status: "active",
              seconds_since_change: 1,
              last_seen_at: "2026-07-03T10:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithClient(<SessionWindow index={0} />);

    const select = await screen.findByRole("combobox", { name: "Window 1 session selector" });
    await screen.findByRole("option", { name: "[Alpha HQ]--[Alpha Zed]" });
    await screen.findByRole("option", { name: "[m-gamma]--[sess-able]" });
    await screen.findByRole("option", { name: "[Zeta Corp]--[Zeta Beta]" });

    const optionTexts = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(optionTexts).toEqual([
      "Select a tmux session",
      "[Alpha HQ]--[Alpha Zed]",
      "[m-gamma]--[sess-able]",
      "[Zeta Corp]--[Zeta Beta]",
    ]);
  });

  it("keeps option value as machine_id::session_id for selection behavior", async () => {
    server.use(
      http.get("*/machines", () =>
        HttpResponse.json({
          machines: [
            { machine_id: "mach-1", display_name: "My Machine", last_seen_at: "2026-07-03T10:00:00Z", session_count: 1, is_stale: false },
          ],
        }),
      ),
      http.get("*/sessions", () =>
        HttpResponse.json({
          sessions: [
            {
              machine_id: "mach-1",
              session_id: "sess-1",
              label: "Dev Session",
              status: "active",
              seconds_since_change: 1,
              last_seen_at: "2026-07-03T10:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithClient(<SessionWindow index={0} />);

    const select = await screen.findByRole("combobox", { name: "Window 1 session selector" });
    const sessionOption = await screen.findByRole("option", { name: "[My Machine]--[Dev Session]" });
    const options = within(select).getAllByRole("option");

    expect(options).toContain(sessionOption);
    expect(sessionOption.getAttribute("value")).toBe("mach-1::sess-1");
  });
});
