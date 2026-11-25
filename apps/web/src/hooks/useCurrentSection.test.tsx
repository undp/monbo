import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentSection } from "./useCurrentSection";

const IDS = ["calculation", "layers", "area"] as const;
const OFFSET = 80;

// jsdom has no layout: each section's top and the page's height are set per test
let tops: Record<string, number> = {};
let pageHeight = 3000;

const Page = () => {
  const current = useCurrentSection(IDS, OFFSET);
  return (
    <>
      <output>{current ?? "none"}</output>
      {IDS.map((id) => (
        <section key={id} id={id} />
      ))}
    </>
  );
};

const scrollTo = (y: number, nextTops: Record<string, number>) => {
  tops = nextTops;
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  fireEvent.scroll(window);
  // The hook updates once per frame
  act(() => {
    vi.runAllTimers();
  });
};

describe("useCurrentSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    tops = { calculation: 100, layers: 900, area: 1600 };
    pageHeight = 3000;
    const original = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.tagName !== "SECTION") return original.call(this);
      return { top: tops[this.id] } as DOMRect;
    });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      get: () => pageHeight,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts on the first section", () => {
    render(<Page />);
    expect(screen.getByRole("status").textContent).toBe("calculation");
  });

  it("follows the scroll to the last section under the header", () => {
    render(<Page />);
    scrollTo(800, { calculation: -700, layers: 100, area: 800 });
    expect(screen.getByRole("status").textContent).toBe("layers");
  });

  it("marks the last section at the page's end, though its top never reaches the header", () => {
    render(<Page />);
    // A short last section: at the end of the page its top is still at 290 px
    scrollTo(2200, { calculation: -2100, layers: -1300, area: 290 });
    expect(screen.getByRole("status").textContent).toBe("area");
  });
});
