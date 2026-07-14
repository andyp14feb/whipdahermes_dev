import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { queryClient } from "../app/App";
import { LAYOUT_STORAGE_KEY, useAppStore } from "../shared/state/appStore";
import {
  DEFAULT_TEMPLATE_ACTIONS,
  STORAGE_KEY,
  useSettingsStore,
} from "../shared/state/settingsStore";

export const server = setupServer();

const defaultHandlers = [
  http.get("*/dashboard/settings", () =>
    HttpResponse.json({
      exists: false,
      templateActions: [],
      nudgesBySession: {},
    }),
  ),
  http.put("*/dashboard/settings", () => HttpResponse.json({ ok: true })),
  http.get("*/dashboard/nudger/status", () =>
    HttpResponse.json({
      running: true,
      task_name: "background-nudger",
      interval_seconds: 5,
      last_started_at: "2026-07-14T00:00:00Z",
      last_stopped_at: null,
      last_tick_at: "2026-07-14T00:00:05Z",
      last_error: null,
      last_checked_sessions: 0,
      last_sent_nudges: 0,
    }),
  ),
  http.post("*/dashboard/nudger/start", () =>
    HttpResponse.json({
      started: true,
      running: true,
      task_name: "background-nudger",
      interval_seconds: 5,
      last_started_at: "2026-07-14T00:00:00Z",
      last_stopped_at: null,
      last_tick_at: "2026-07-14T00:00:05Z",
      last_error: null,
      last_checked_sessions: 0,
      last_sent_nudges: 0,
    }),
  ),
  http.post("*/dashboard/nudger/stop", () =>
    HttpResponse.json({
      stopped: true,
      running: false,
      task_name: null,
      interval_seconds: 5,
      last_started_at: "2026-07-14T00:00:00Z",
      last_stopped_at: "2026-07-14T00:00:10Z",
      last_tick_at: "2026-07-14T00:00:05Z",
      last_error: null,
      last_checked_sessions: 0,
      last_sent_nudges: 0,
    }),
  ),
];

beforeAll(() => {
  server.use(...defaultHandlers);
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.use(...defaultHandlers);
  queryClient.clear();

  useAppStore.setState({
    selectedMachineId: null,
    selectedSessionId: null,
    connectionError: null,
    connectionFailureCount: 0,
    windows: [{ machineId: null, sessionId: null, heightPx: 480 }],
    activeWindowIndex: 0,
    windowColumnCount: 1,
    leftPanelVisible: true,
    leftPanelWidthPx: 320,
  });

  useSettingsStore.setState({
    workerApiUrl: "http://localhost:8000",
    refreshIntervalMs: 2000,
    staleTimeoutSeconds: 60,
    aiProviderBaseUrl: "",
    aiApiKey: "",
    aiSelectedModel: "",
    aiProviderName: "",
    themeMode: "light",
    templateActions: DEFAULT_TEMPLATE_ACTIONS.map((action) => ({ ...action })),
    nudgesBySession: {},
    isDirty: false,
  });

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LAYOUT_STORAGE_KEY);
});

afterAll(() => server.close());
