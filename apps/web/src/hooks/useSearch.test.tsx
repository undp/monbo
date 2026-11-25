import { act, renderHook } from "@testing-library/react";
import type { IFuseOptions } from "fuse.js";
import { describe, expect, it } from "vitest";
import { useSearch } from "./useSearch";
import { useSortedTable } from "./useSortedTable";

interface Producer {
  name: string;
}

const PRODUCERS: Producer[] = [
  { name: "Ana Pérez" },
  { name: "Luis Mora" },
  { name: "Carla Rojas" },
];
// Stable references: the hook memoizes on them, as callers do.
const BY_NAME: IFuseOptions<Producer> = { keys: ["name"] };
const BY_NAME_IGNORING_ACCENTS: IFuseOptions<Producer> = {
  keys: ["name"],
  ignoreDiacritics: true,
  // Exact matches only, anywhere in the name: the accent is the only difference.
  threshold: 0,
  ignoreLocation: true,
};

describe("useSearch", () => {
  it("returns the whole list for an empty query", () => {
    const { result } = renderHook(() => useSearch(PRODUCERS, "", BY_NAME));

    expect(result.current).toBe(PRODUCERS);
  });

  it("finds an approximate match", () => {
    const { result } = renderHook(() => useSearch(PRODUCERS, "Mra", BY_NAME));

    expect(result.current[0]).toEqual({ name: "Luis Mora" });
  });

  it("matches without accents when the options ignore them", () => {
    const { result } = renderHook(() =>
      useSearch(PRODUCERS, "perez", BY_NAME_IGNORING_ACCENTS)
    );

    expect(result.current).toEqual([{ name: "Ana Pérez" }]);
  });
});

describe("useSortedTable", () => {
  it("cycles a column through ascending, descending and unsorted", () => {
    const { result } = renderHook(useSortedTable);
    const sortBy = (attr: string) => act(() => result.current[1](attr));

    expect(result.current[0]).toBeNull();
    sortBy("producer");
    expect(result.current[0]).toEqual({ attr: "producer", order: "asc" });
    sortBy("producer");
    expect(result.current[0]).toEqual({ attr: "producer", order: "desc" });
    sortBy("producer");
    expect(result.current[0]).toBeNull();
  });

  it("starts another column ascending", () => {
    const { result } = renderHook(useSortedTable);

    act(() => result.current[1]("producer"));
    act(() => result.current[1]("producer"));
    act(() => result.current[1]("area"));

    expect(result.current[0]).toEqual({ attr: "area", order: "asc" });
  });
});
