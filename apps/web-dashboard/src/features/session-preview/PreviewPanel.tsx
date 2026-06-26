import { StatusSummary } from "../status-summary/StatusSummary";
import { Card } from "../../shared/ui/Card";
import type { SessionDetail } from "../../shared/types/contracts";

interface PreviewPanelProps {
  session: SessionDetail;
}

export function PreviewPanel({ session }: PreviewPanelProps) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{session.label}</h2>
        <p className="text-xs text-gray-400">{session.session_id}</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <StatusSummary
          status={session.status}
          secondsSinceChange={session.seconds_since_change}
        />
        {session.cwd && (
          <span className="text-xs text-gray-500" title="Working directory">
            {session.cwd}
          </span>
        )}
      </div>

      <div className="rounded border border-gray-100 bg-gray-50 p-3">
        {session.preview ? (
          <pre className="max-h-96 overflow-auto font-mono text-sm whitespace-pre-wrap">
            {session.preview}
          </pre>
        ) : (
          <p className="font-mono text-sm text-gray-400">No preview available</p>
        )}
      </div>
    </Card>
  );
}
