import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import { notifyUploadErrors } from "./uploadErrors";

const t = ((key: string, options?: { count: number }) =>
  `${key}:${options?.count}`) as unknown as TFunction;

const errors = (n: number) => Array.from({ length: n }, (_, i) => `Error in row ${i + 4}`);

describe("notifyUploadErrors", () => {
  it("shows every error when there are few", () => {
    const openSnackbar = vi.fn();

    notifyUploadErrors(openSnackbar, errors(3), t);

    expect(openSnackbar.mock.calls.map(([n]) => n.message)).toEqual([
      "Error in row 4",
      "Error in row 5",
      "Error in row 6",
    ]);
  });

  it("shows the first 5 errors and one notice with the rest", () => {
    const openSnackbar = vi.fn();

    notifyUploadErrors(openSnackbar, errors(1000), t);

    expect(openSnackbar).toHaveBeenCalledTimes(6);
    expect(openSnackbar.mock.calls[4][0].message).toBe("Error in row 8");
    expect(openSnackbar.mock.calls[5][0]).toEqual({
      message: "common:snackbarAlerts:moreUploadErrors:995",
      type: "error",
    });
  });

  it("adds no summary for exactly 5 errors", () => {
    const openSnackbar = vi.fn();
    notifyUploadErrors(openSnackbar, errors(5), t);
    expect(openSnackbar).toHaveBeenCalledTimes(5);
  });
});
