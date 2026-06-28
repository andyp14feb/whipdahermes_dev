import { StatusSummary } from "../status-summary/StatusSummary";
import { Card } from "../../shared/ui/Card";
import { TerminalView } from "./TerminalView";
import type { SessionDetail } from "../../shared/types/contracts";

interface PreviewPanelProps {
  session: SessionDetail;
  onAssess?: () => void;
  isAssessing?: boolean;
  assessError?: string | null;
}

export function PreviewPanel({
  session,
  onAssess,
  isAssessing,
  assessError,
}: PreviewPanelProps) {
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

      {session.ai_assessment && (
        <div className="mb-3 flex items-center gap-2 rounded bg-blue-50 p-2 text-sm">
          <span className="font-semibold text-blue-800">
            {session.ai_assessment}
          </span>
          {session.ai_assessment_reason && (
            <span className="text-blue-600">
              {session.ai_assessment_reason}
            </span>
          )}
          {session.ai_assessed_at && (
            <span className="text-xs text-blue-400">
              {session.ai_assessed_at}
            </span>
          )}
        </div>
      )}

      <div className="mb-3">
        <button
          onClick={onAssess}
          disabled={isAssessing}
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isAssessing ? "Assessing..." : "Assess"}
        </button>
        {assessError && (
          <p className="mt-1 text-sm text-red-600">{assessError}</p>
        )}
      </div>

      {session.preview ? (
        <TerminalView output={session.preview} />
      ) : (
        <div className="rounded border border-gray-700 bg-[#1e1e1e] p-3">
          <p className="font-mono text-sm text-gray-400">No preview available</p>
        </div>
      )}
    </Card>
  );
}
