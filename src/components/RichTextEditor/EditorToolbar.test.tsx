/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";

describe("EditorToolbar", () => {
  it("renders custom tooltip content without native title attributes", () => {
    render(
      <EditorToolbar
        activeStyles={{
          bold: false,
          italic: false,
          underline: false,
        }}
        textColor="#ffffff"
        backgroundColor="#fef08a"
        onCommand={vi.fn()}
        onColorChange={vi.fn()}
        onBackgroundColorChange={vi.fn()}
      />,
    );

    const boldButton = screen.getByRole("button", { name: "Bold (Ctrl+B)" });
    expect(boldButton.getAttribute("title")).toBeNull();
    expect(screen.getByText("Bold (Ctrl+B)")).toBeDefined();

    const textColorInput = screen.getByLabelText("Text Color");
    expect(textColorInput.getAttribute("title")).toBeNull();
    expect(screen.getByText("Text Color")).toBeDefined();

    const backgroundColorInput = screen.getByLabelText("Text Background Color");
    expect(backgroundColorInput.getAttribute("title")).toBeNull();
    expect(screen.getByText("Text Background Color")).toBeDefined();
  });
});
