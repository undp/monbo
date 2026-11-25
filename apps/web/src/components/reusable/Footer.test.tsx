import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestI18n } from "@/test/i18n";

const env = vi.hoisted(() => ({ showWarning: false }));
vi.mock("@/config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/env")>()),
  get SHOW_TESTING_ENVIRONMENT_WARNING() {
    return env.showWarning;
  },
}));

const { Footer } = await import("./Footer");

const renderFooter = async () => {
  const i18n = await createTestI18n("en");
  render(
    <I18nextProvider i18n={i18n}>
      <Footer>
        <button>Continue</button>
      </Footer>
    </I18nextProvider>
  );
  return screen.getByRole("button", { name: "Continue" }).parentElement!;
};

afterEach(() => {
  env.showWarning = false;
});

describe("Footer", () => {
  // Production has no testing banner; the actions used to slide to the left.
  it("keeps the actions on the right without the testing banner", async () => {
    const actions = await renderFooter();
    expect(screen.queryByTestId("WarningIcon")).toBeNull();
    expect(getComputedStyle(actions).marginLeft).toBe("auto");
  });

  it("shows the testing banner before the actions when enabled", async () => {
    env.showWarning = true;
    const actions = await renderFooter();
    const warning = screen.getByTestId("WarningIcon");
    expect(
      warning.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(getComputedStyle(actions).marginLeft).toBe("auto");
  });
});
