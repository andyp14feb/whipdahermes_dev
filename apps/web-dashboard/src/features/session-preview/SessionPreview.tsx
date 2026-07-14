import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../../shared/state/appStore";
import { useSettingsStore } from "../../shared/state/settingsStore";
import type { StatusValue } from "../../shared/types/contracts";
import { fetchSessionDetail } from "./sessionPreview.api";
import { PreviewPanel } from "./PreviewPanel";
import { Card } from "../../shared/ui/Card";

interface SessionPreviewProps {
  machineId?: string | null;
  sessionId?: string | null;
  heightPx?: number;
  onAutoAssess?: () => void;
  onSelectionHoldChange?: (isHeld: boolean) => void;
}

const assessStatuses = new Set<StatusValue>(["stuck", "waiting", "waiting_input"]);

function shouldAssessTransition(
  previousStatus: StatusValue | null,
  nextStatus: StatusValue,
): boolean {
  if (previousStatus === null) return false;
  if (previousStatus === nextStatus) return false;
  return assessStatuses.has(nextStatus);
}

export function SessionPreview({
  machineId: propMachineId,
  sessionId: propSessionId,
  heightPx,
  onAutoAssess,
  onSelectionHoldChange,
}: SessionPreviewProps) {
  const storeMachineId = useAppStore((s) => s.selectedMachineId);
  const storeSessionId = useAppStore((s) => s.selectedSessionId);
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);
  const lastStatusRef = useRef<StatusValue | null>(null);
  const [isPreviewSelectionHeld, setIsPreviewSelectionHeld] = useState(false);

  const machineId = propMachineId !== undefined ? propMachineId : storeMachineId;
  const sessionId = propSessionId !== undefined ? propSessionId : storeSessionId;

  const query = useQuery({
    queryKey: ["session-detail", machineId, sessionId],
    queryFn: () => fetchSessionDetail(machineId!, sessionId!),
    enabled: !!machineId && !!sessionId,
    refetchInterval: isPreviewSelectionHeld ? false : refreshIntervalMs,
  });

  const handleSelectionHoldChange = useCallback(
    (isHeld: boolean) => {
      setIsPreviewSelectionHeld(isHeld);
      onSelectionHoldChange?.(isHeld);
    },
    [onSelectionHoldChange],
  );

  useEffect(() => {
    if (!machineId || !sessionId || !onAutoAssess) {
      lastStatusRef.current = null;
      return;
    }
    const currentStatus = query.data?.status;
    if (!currentStatus) return;

    const previousStatus = lastStatusRef.current;
    if (shouldAssessTransition(previousStatus, currentStatus)) {
      onAutoAssess();
    }
    lastStatusRef.current = currentStatus;
  }, [machineId, onAutoAssess, query.data?.status, sessionId]);

  if (!machineId || !sessionId) {
    return (
      <Card className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-gray-400">Select a session to view details</p>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-gray-500">Loading session details...</p>
      </Card>
    );
  }

  if (query.error && !query.data) {
    return (
      <Card className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-red-600">Failed to load session details.</p>
      </Card>
    );
  }

  if (!query.data) {
    return (
      <Card className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-gray-400">Session not found</p>
      </Card>
    );
  }

  return (
    <PreviewPanel
      session={query.data}
      heightPx={heightPx}
      onSelectionHoldChange={handleSelectionHoldChange}
    />
  );
}
