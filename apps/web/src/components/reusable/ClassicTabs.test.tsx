import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClassicTabs } from "./ClassicTabs";

const tab = (id: number) => ({
  id,
  title: `Tab ${id}`,
  content: <p>Content {id}</p>,
});

describe("ClassicTabs", () => {
  it("shows the content of the selected tab", () => {
    render(<ClassicTabs tabs={[tab(1), tab(2)]} />);
    expect(screen.getByText("Content 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));

    expect(screen.getByText("Content 2")).toBeTruthy();
    expect(screen.queryByText("Content 1")).toBeNull();
  });

  it("falls back to the first tab when the selected one disappears", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ClassicTabs tabs={[tab(1), tab(2), tab(3)]} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Tab 3" }));
    expect(screen.getByText("Content 3")).toBeTruthy();

    // Rendering with fewer tabs used to read tabs[2].id and throw a TypeError.
    rerender(<ClassicTabs tabs={[tab(1), tab(2)]} onChange={onChange} />);

    expect(screen.getByText("Content 1")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Tab 1" }).getAttribute("aria-selected")
    ).toBe("true");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
