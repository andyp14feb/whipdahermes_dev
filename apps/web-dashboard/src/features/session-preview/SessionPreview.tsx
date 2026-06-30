import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "../../shared/api-client/apiClient";
import { useAppStore } from "../../shared/state/appStore";
import { useSettingsStore } from "../../shared/state/settingsStore";
import type { StatusValue } from "../../shared/types/contracts";
import { assessSession, fetchSessionDetail } from "./sessionPreview.api";
import { PreviewPanel } from "./PreviewPanel";
import { Card } from "../../shared/ui/Card";

interface SessionPreviewProps {
  machineId?: string | null;
  sessionId?: string | null;
  heightPx?: number;
}

const assessStatuses = new Set<StatusValue>(["stuck", "waiting", "waiting_input"]);

function shouldAssessTransition(
  previousStatus: StatusValue | null,
  nextStatus: StatusValue,
): boolean {
  if (previousStatus === null) {
    return false;
  }
  if (previousStatus === nextStatus) {
    return false;
  }
  return assessStatuses.has(nextStatus);
}

export function SessionPreview({
  machineId: propMachineId,
  sessionId: propSessionId,
  heightPx,
}: SessionPreviewProps) {
  const storeMachineId = useAppStore((s) => s.selectedMachineId);
  const storeSessionId = useAppStore((s) => s.selectedSessionId);
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);
  const queryClient = useQueryClient();
  const lastStatusRef = useRef<StatusValue | null>(null);

  const machineId = propMachineId !== undefined ? propMachineId : storeMachineId;
  const sessionId = propSessionId !== undefined ? propSessionId : storeSessionId;

  const query = useQuery({
    queryKey: ["session-detail", machineId, sessionId],
    queryFn: () => fetchSessionDetail(machineId!, sessionId!),
    enabled: !!machineId && !!sessionId,
    refetchInterval: refreshIntervalMs,
  });

  const assessMutation = useMutation({
    mutationFn: () => assessSession(machineId!, sessionId!),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["session-detail", machineId, sessionId],
        query.data ? { ...query.data, ...data } : data,
      );
    },
  });

  useEffect(() => {
    if (!machineId || !sessionId) {
      lastStatusRef.current = null;
      return;
    }
    const currentStatus = query.data?.status;
    if (!currentStatus) {
      return;
    }
    const previousStatus = lastStatusRef.current;
    if (
      shouldAssessTransition(previousStatus, currentStatus) &&
      !assessMutation.isPending
    ) {
      assessMutation.mutate();
    }
    lastStatusRef.current = currentStatus;
  }, [assessMutation, machineId, query.data?.status, sessionId]);

  const handleAssess = () => {
    if (!machineId || !sessionId) return;
    assessMutation.mutate();
  };

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

  const assessError = assessMutation.error;
  const assessErrorMessage =
    assessError instanceof ApiRequestError && assessError.status === 503
      ? "AI assessor is not configured yet"
      : assessError instanceof ApiRequestError && assessError.status === 409
        ? "AI assessment only runs when a session turns stuck or waiting"
        : assessError instanceof DOMException && assessError.name === "AbortError"
        ? "AI assessment timed out while waiting for the provider"
        : assessError instanceof Error
          ? assessError.message
          : null;

  return (
    <PreviewPanel
      session={query.data}
      onAssess={handleAssess}
      isAssessing={assessMutation.isPending}
      assessError={assessErrorMessage}
      heightPx={heightPx}
    />
  );
}
