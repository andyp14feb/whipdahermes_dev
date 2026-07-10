import { create } from "zustand";

interface WindowSlot {
  machineId: string | null;
  sessionId: string | null;
  heightPx: number;
}

type WindowColumnCount = 1 | 2;

const EMPTY_SLOT: WindowSlot = { machineId: null, sessionId: null, heightPx: 480 };

interface LayoutPersistedState {
  windows: WindowSlot[];
  activeWindowIndex: number;
  windowColumnCount: WindowColumnCount;
  leftPanelVisible: boolean;
  leftPanelWidthPx: number;
}

export const LAYOUT_STORAGE_KEY = "whipai.layout";

interface AppState {
  selectedMachineId: string | null;
  selectedSessionId: string | null;
  connectionError: string | null;
  connectionFailureCount: number;
  windows: WindowSlot[];
  activeWindowIndex: number;
  windowColumnCount: WindowColumnCount;
  leftPanelVisible: boolean;
  leftPanelWidthPx: number;
  setSelectedSession: (machineId: string, sessionId: string) => void;
  setWindowSelection: (index: number, machineId: string | null, sessionId: string | null) => void;
  clearSelection: () => void;
  clearWindowSelection: (index: number) => void;
  setWindowHeight: (index: number, heightPx: number) => void;
  addWindow: () => void;
  removeWindow: (index: number) => void;
  setWindowColumnCount: (count: WindowColumnCount) => void;
  setLeftPanelVisible: (visible: boolean) => void;
  setLeftPanelWidth: (widthPx: number) => void;
  setConnectionError: (error: string | null) => void;
  recordConnectionFailure: (error: string) => void;
  recordConnectionSuccess: () => void;
  setActiveWindow: (index: number) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function selectedFromSlot(slot: WindowSlot | undefined) {
  return {
    selectedMachineId: slot?.machineId ?? null,
    selectedSessionId: slot?.sessionId ?? null,
  };
}

function isWindowColumnCount(value: unknown): value is WindowColumnCount {
  return value === 1 || value === 2;
}

function loadLayoutFromStorage(): LayoutPersistedState {
  const defaults: LayoutPersistedState = {
    windows: [{ ...EMPTY_SLOT }],
    activeWindowIndex: 0,
    windowColumnCount: 1,
    leftPanelVisible: true,
    leftPanelWidthPx: 320,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<LayoutPersistedState> | null;
    if (!parsed) return defaults;
    const windows = Array.isArray(parsed.windows) && parsed.windows.length > 0
      ? parsed.windows.map((slot) => ({
          machineId: typeof slot?.machineId === "string" ? slot.machineId : null,
          sessionId: typeof slot?.sessionId === "string" ? slot.sessionId : null,
          heightPx: typeof slot?.heightPx === "number" ? clamp(slot.heightPx, 280, 1200) : EMPTY_SLOT.heightPx,
        }))
      : defaults.windows;
    const activeWindowIndex = typeof parsed.activeWindowIndex === "number"
      ? clamp(parsed.activeWindowIndex, 0, windows.length - 1)
      : 0;
    return {
      windows,
      activeWindowIndex,
      windowColumnCount: isWindowColumnCount(parsed.windowColumnCount) ? parsed.windowColumnCount : 1,
      leftPanelVisible: typeof parsed.leftPanelVisible === "boolean" ? parsed.leftPanelVisible : true,
      leftPanelWidthPx: typeof parsed.leftPanelWidthPx === "number"
        ? clamp(parsed.leftPanelWidthPx, 240, 640)
        : 320,
    };
  } catch {
    return defaults;
  }
}

function persistLayout(layout: LayoutPersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota / disabled storage errors */
  }
}

function snapshotLayout(state: Pick<AppState, "windows" | "activeWindowIndex" | "windowColumnCount" | "leftPanelVisible" | "leftPanelWidthPx">): LayoutPersistedState {
  return {
    windows: state.windows.map((slot) => ({ ...slot })),
    activeWindowIndex: state.activeWindowIndex,
    windowColumnCount: state.windowColumnCount,
    leftPanelVisible: state.leftPanelVisible,
    leftPanelWidthPx: state.leftPanelWidthPx,
  };
}

const initialLayout = loadLayoutFromStorage();
const initialSelection = selectedFromSlot(initialLayout.windows[initialLayout.activeWindowIndex]);

export const useAppStore = create<AppState>((set, get) => {
  const persistCurrent = () => persistLayout(snapshotLayout(get()));

  return {
    ...initialSelection,
    connectionError: null,
    connectionFailureCount: 0,
    windows: initialLayout.windows,
    activeWindowIndex: initialLayout.activeWindowIndex,
    windowColumnCount: initialLayout.windowColumnCount,
    leftPanelVisible: initialLayout.leftPanelVisible,
    leftPanelWidthPx: initialLayout.leftPanelWidthPx,
    setSelectedSession: (machineId, sessionId) =>
      set((state) => {
        const windows = [...state.windows];
        const current = windows[state.activeWindowIndex] ?? EMPTY_SLOT;
        windows[state.activeWindowIndex] = { machineId, sessionId, heightPx: current.heightPx };
        return {
          windows,
          selectedMachineId: machineId,
          selectedSessionId: sessionId,
        };
      }),
    setWindowSelection: (index, machineId, sessionId) =>
      set((state) => {
        const windows = [...state.windows];
        const current = windows[index] ?? EMPTY_SLOT;
        windows[index] = { machineId, sessionId, heightPx: current.heightPx };
        return { windows };
      }),
    clearSelection: () =>
      set((state) => {
        const windows = [...state.windows];
        const current = windows[state.activeWindowIndex] ?? EMPTY_SLOT;
        windows[state.activeWindowIndex] = { ...EMPTY_SLOT, heightPx: current.heightPx };
        return {
          windows,
          selectedMachineId: null,
          selectedSessionId: null,
        };
      }),
    clearWindowSelection: (index) =>
      set((state) => {
        const windows = [...state.windows];
        const current = windows[index] ?? EMPTY_SLOT;
        windows[index] = { ...EMPTY_SLOT, heightPx: current.heightPx };
        return { windows };
      }),
    setWindowHeight: (index, heightPx) =>
      set((state) => {
        const windows = [...state.windows];
        const current = windows[index] ?? EMPTY_SLOT;
        windows[index] = { ...current, heightPx: clamp(heightPx, 280, 1200) };
        return { windows };
      }),
    addWindow: () => {
      set((state) => {
        const windows = [...state.windows, { ...EMPTY_SLOT }];
        return { windows, activeWindowIndex: windows.length - 1, ...selectedFromSlot(windows.at(-1)) };
      });
      persistCurrent();
    },
    removeWindow: (index) => {
      let changed = false;
      set((state) => {
        if (state.windows.length <= 1) return state;
        const windows = state.windows.filter((_, i) => i !== index);
        const activeWindowIndex = clamp(
          index === state.activeWindowIndex ? Math.min(index, windows.length - 1) : state.activeWindowIndex > index ? state.activeWindowIndex - 1 : state.activeWindowIndex,
          0,
          windows.length - 1,
        );
        changed = true;
        return { windows, activeWindowIndex, ...selectedFromSlot(windows[activeWindowIndex]) };
      });
      if (changed) persistCurrent();
    },
    setWindowColumnCount: (windowColumnCount) => {
      set({ windowColumnCount });
      persistCurrent();
    },
    setLeftPanelVisible: (leftPanelVisible) => {
      set({ leftPanelVisible });
      persistCurrent();
    },
    setLeftPanelWidth: (widthPx) => {
      const leftPanelWidthPx = clamp(widthPx, 240, 640);
      set({ leftPanelWidthPx });
      persistLayout(snapshotLayout({ ...get(), leftPanelWidthPx }));
    },
    setConnectionError: (error) => set({ connectionError: error }),
    recordConnectionFailure: (error) =>
      set((state) => {
        const connectionFailureCount = state.connectionFailureCount + 1;
        return {
          connectionFailureCount,
          connectionError:
            connectionFailureCount >= 2
              ? error
              : state.connectionError,
        };
      }),
    recordConnectionSuccess: () =>
      set({ connectionFailureCount: 0, connectionError: null }),
    setActiveWindow: (index) => {
      set((state) => ({
        activeWindowIndex: index,
        ...selectedFromSlot(state.windows[index]),
      }));
      persistCurrent();
    },
  };
});