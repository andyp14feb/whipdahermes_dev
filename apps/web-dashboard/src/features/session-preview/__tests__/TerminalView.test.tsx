import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TerminalView } from "../TerminalView";

describe("TerminalView", () => {
  it("holds output refresh while text selection is in progress", async () => {
    const holdChange = vi.fn();
    const { rerender } = render(
      <TerminalView output="first output" onSelectionHoldChange={holdChange} />,
    );

    const terminal = screen.getByText("first output").parentElement!;
    fireEvent.pointerDown(terminal);

    rerender(<TerminalView output="second output" onSelectionHoldChange={holdChange} />);

    expect(screen.getByText("first output")).toBeInTheDocument();
    expect(screen.queryByText("second output")).not.toBeInTheDocument();
    expect(holdChange).toHaveBeenCalledWith(true);

    fireEvent.pointerUp(terminal);

    await waitFor(() => {
      expect(screen.getByText("second output")).toBeInTheDocument();
    });
    expect(holdChange).toHaveBeenCalledWith(false);
  });
});
