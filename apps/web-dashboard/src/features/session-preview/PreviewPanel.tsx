import { Card } from "../../shared/ui/Card";
import { TerminalView } from "./TerminalView";
import type { SessionDetail } from "../../shared/types/contracts";

interface PreviewPanelProps {
  session: SessionDetail;
  heightPx?: number;
  onSelectionHoldChange?: (isHeld: boolean) => void;
}

export function PreviewPanel({ session, heightPx = 480, onSelectionHoldChange }: PreviewPanelProps) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-3">
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

      <div className="min-h-0 flex-1">
        {session.preview ? (
          <TerminalView
            output={session.preview}
            heightPx={heightPx}
            onSelectionHoldChange={onSelectionHoldChange}
          />
        ) : (
          <div className="rounded border border-gray-700 bg-[#1e1e1e] p-3">
            <p className="font-mono text-sm text-gray-400">No preview available</p>
          </div>
        )}
      </div>
    </Card>
  );
}
