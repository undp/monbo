import { useEffect, useState } from "react";

/**
 * The section being read, for a page's index to mark it: the last of `ids` whose
 * top has passed `offset` px plus some air (the fixed header), or the last one
 * once the page is scrolled to its end, where a short last section never reaches
 * the header. Followed on scroll and resize, at most once per frame. Null until
 * the page has those sections.
 */
export const useCurrentSection = (ids: readonly string[], offset: number): string | null => {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => !!element);
    if (!sections.length) return;

    const update = () => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const passed = sections.filter(
        (section) => section.getBoundingClientRect().top <= offset + 40
      );
      const section = atBottom ? sections.at(-1) : (passed.at(-1) ?? sections[0]);
      setCurrent(section?.id ?? null);
    };

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        update();
      });
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids, offset]);

  return current;
};
