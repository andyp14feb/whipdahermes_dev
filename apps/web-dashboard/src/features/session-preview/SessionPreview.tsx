import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "../../shared/api-client/apiClient";
import { useAppStore } from "../../shared/state/appStore";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { assessSession, fetchSessionDetail } from "./sessionPreview.api";
import { PreviewPanel } from "./PreviewPanel";
import { Card } from "../../shared/ui/Card";

interface SessionPreviewProps {
  machineId?: string | null;
  sessionId?: string | null;
}

export function SessionPreview({
  machineId: propMachineId,
  sessionId: propSessionId,
}: SessionPreviewProps) {
  const storeMachineId = useAppStore((s) => s.selectedMachineId);
  const storeSessionId = useAppStore((s) => s.selectedSessionId);
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);
  const queryClient = useQueryClient();

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
      : assessError instanceof Error
        ? assessError.message
        : null;

  return (
    <PreviewPanel
      session={query.data}
      onAssess={handleAssess}
      isAssessing={assessMutation.isPending}
      assessError={assessErrorMessage}
    />
  );
}
