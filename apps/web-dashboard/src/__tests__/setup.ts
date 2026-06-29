import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { queryClient } from "../app/App";
import { useAppStore } from "../shared/state/appStore";
import {
  DEFAULT_TEMPLATE_ACTIONS,
  STORAGE_KEY,
  useSettingsStore,
} from "../shared/state/settingsStore";

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  queryClient.clear();

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
});

afterAll(() => server.close());
