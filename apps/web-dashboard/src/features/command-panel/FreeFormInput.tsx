import { useState, type KeyboardEvent } from "react";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/Input";
import { sendCommand } from "./commandPanel.api";

interface FreeFormInputProps {
  machineId: string;
  sessionId: string;
  onCommandSent?: (commandId: string, payload: string) => void;
}

export function FreeFormInput({
  machineId,
  sessionId,
  onCommandSent,
}: FreeFormInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = inputValue.trim();
  const canSend = trimmed.length > 0 && !isSending;

  async function handleSend() {
    if (!canSend) return;
    setIsSending(true);
    setError(null);

    try {
      const response = await sendCommand(machineId, sessionId, trimmed);
      setInputValue("");
      onCommandSent?.(response.command_id, trimmed);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to send command";
      if (message.toLowerCase().includes("signal is aborted") || message === "Request timed out or was cancelled") {
        setError("Request cancelled");
      } else {
        setError(message);
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2 items-start">
        <div className="flex-1">
          <Input
            type="textarea"
            rows={2}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a custom command..."
            disabled={isSending}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={!canSend}
          className="w-[80px]"
        >
          {isSending ? (
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Send
            </span>
          ) : (
            "Send"
          )}
        </Button>
      </form>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">Press Ctrl+Enter to send. Enter inserts a new line.</p>
    </div>
  );
}
