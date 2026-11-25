import { onTestFinished, vi } from "vitest";

/**
 * jsdom has no object URLs. Installs spies for URL.createObjectURL (returning
 * "blob:test/1", "blob:test/2", …) and URL.revokeObjectURL until the test ends.
 */
export const stubObjectUrls = () => {
  const original = {
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  };
  let count = 0;
  const createObjectURL = vi.fn<typeof URL.createObjectURL>(() => `blob:test/${++count}`);
  const revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  onTestFinished(() => {
    URL.createObjectURL = original.createObjectURL;
    URL.revokeObjectURL = original.revokeObjectURL;
  });
  return { createObjectURL, revokeObjectURL };
};
