import { describe, expect, it, vi } from "vitest";
import AdminEditCategoryPage from "./page";

vi.mock("next/navigation", async () => ({
  ...(await import("@/test/navigation")).navigationMock,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const page = (id: string) =>
  AdminEditCategoryPage({ params: Promise.resolve({ locale: "en", id }) });

describe("AdminEditCategoryPage", () => {
  it.each(["Protected-Areas", "1st", "protected areas", "a".repeat(51)])(
    "answers 404 for %s, an id the API never gives",
    async (id) => {
      await expect(page(id)).rejects.toThrow("NEXT_NOT_FOUND");
    }
  );

  it("opens the editor of a well-formed id", async () => {
    const element = await page("protected_areas");
    expect(element.props).toEqual({ categoryId: "protected_areas" });
  });
});
