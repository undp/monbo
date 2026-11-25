import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { createTestI18n } from "@/test/i18n";
import { setPathname } from "@/test/navigation";
import { HeaderNavigation } from "./HeaderNavigation";

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "EC" };

const renderNavigation = async (signedIn: boolean) => {
  const i18n = await createTestI18n("en");
  render(
    <I18nextProvider i18n={i18n}>
      <AdminSessionContext.Provider
        value={{
          session: signedIn ? session : null,
          ready: true,
          login: vi.fn(),
          logout: vi.fn(),
          withToken: vi.fn(),
        }}
      >
        <HeaderNavigation>
          <span>country selector</span>
        </HeaderNavigation>
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

describe("header navigation", () => {
  it.each(["/en/admin/layers", "/admin/categories", "/en/admin"])(
    "shows no sections, country or country selector on %s",
    async (path) => {
      setPathname(path);
      await renderNavigation(true);

      expect(screen.queryByText("country selector")).toBeNull();
      expect(screen.queryByText("Ecuador")).toBeNull();
      expect(screen.queryByRole("button", { name: "Layers" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Layers" })).toBeNull();
    }
  );

  it("keeps the country selector outside the admin", async () => {
    setPathname("/en/polygons-validation");
    await renderNavigation(true);
    expect(screen.getByText("country selector")).toBeTruthy();
  });
});
