import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "../../shared/state/appStore";
import { useSettingsStore } from "../../shared/state/settingsStore";
import { fetchSessionDetail } from "./sessionPreview.api";
import { PreviewPanel } from "./PreviewPanel";
import { Card } from "../../shared/ui/Card";

export function SessionPreview() {
  const selectedMachineId = useAppStore((s) => s.selectedMachineId);
  const selectedSessionId = useAppStore((s) => s.selectedSessionId);
  const refreshIntervalMs = useSettingsStore((s) => s.refreshIntervalMs);

  const query = useQuery({
    queryKey: ["session-detail", selectedMachineId, selectedSessionId],
    queryFn: () =>
      fetchSessionDetail(selectedMachineId!, selectedSessionId!),
    enabled: !!selectedMachineId && !!selectedSessionId,
    refetchInterval: refreshIntervalMs,
  });

  if (!selectedMachineId || !selectedSessionId) {
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

  return <PreviewPanel session={query.data} />;
}
