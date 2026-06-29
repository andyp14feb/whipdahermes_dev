import { StatusSummary } from "../status-summary/StatusSummary";
import { Card } from "../../shared/ui/Card";
import { TerminalView } from "./TerminalView";
import type { SessionDetail } from "../../shared/types/contracts";

interface PreviewPanelProps {
  session: SessionDetail;
  onAssess?: () => void;
  isAssessing?: boolean;
  assessError?: string | null;
  heightPx?: number;
}

export function PreviewPanel({
  session,
  onAssess,
  isAssessing,
  assessError,
  heightPx = 480,
}: PreviewPanelProps) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{session.label}</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500">{session.session_id}</p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusSummary
          status={session.status}
          secondsSinceChange={session.seconds_since_change}
        />
        {session.cwd && (
          <span className="text-xs text-gray-500 dark:text-gray-400" title="Working directory">
            {session.cwd}
          </span>
        )}
      </div>

      {session.ai_assessment && (
        <div className="mb-3 flex items-center gap-2 rounded bg-blue-50 p-2 text-sm dark:bg-blue-950/60">
          <span className="font-semibold text-blue-800 dark:text-blue-200">
            {session.ai_assessment}
          </span>
          {session.ai_assessment_reason && (
            <span className="text-blue-600 dark:text-blue-300">
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

      <div className="min-h-0 flex-1">
        {session.preview ? (
          <TerminalView output={session.preview} maxHeightPx={heightPx} />
        ) : (
          <div className="rounded border border-gray-700 bg-[#1e1e1e] p-3">
            <p className="font-mono text-sm text-gray-400">No preview available</p>
          </div>
        )}
      </div>
    </Card>
  );
}
