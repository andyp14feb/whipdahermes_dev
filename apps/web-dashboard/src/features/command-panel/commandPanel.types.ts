export interface TemplateAction {
  id: string;
  label: string;
  payload: string;
}

export const TEMPLATE_ACTIONS: TemplateAction[] = [
  { id: "yes", label: "yes", payload: "yes" },
  { id: "continue", label: "continue", payload: "continue" },
  { id: "retry", label: "retry", payload: "retry" },
  { id: "skip", label: "skip", payload: "skip" },
  { id: "explain", label: "explain", payload: "explain" },
];

export interface CommandSubmission {
  machine_id: string;
  session_id: string;
  payload: string;
}

export interface CommandEntry {
  id: string;
  payload: string;
  state: import("../../shared/types/contracts").CommandStatus;
  failureReason?: string | null;
}
