"use client";
import Fuse, { IFuseOptions } from "fuse.js";
import { useMemo } from "react";

/**
 * Custom hook to perform a fuzzy search on a list of items.
 *
 * @template T - The type of items in the list.
 * @param {T[]} list - The list of items to search through.
 * @param {string} searchValue - The search string to match against the list items.
 * @param {Object} options - The search options defined by Fuse package.
 * @returns {T[]} - The filtered list of items that match the search criteria.
 */
export const useSearch = <T,>(
  list: T[],
  searchValue: string,
  options: IFuseOptions<T>
): T[] => {
  const fuse = useMemo(
    () =>
      new Fuse(list, {
        threshold: 0.5,
        ...options,
      }),
    [list, options]
  );

  const filteredList = useMemo(
    () =>
      searchValue ? fuse.search(searchValue).map((res) => res.item) : list,
    [searchValue, fuse, list]
  );

  return filteredList;
};
