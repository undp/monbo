import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { createTestI18n } from "@/test/i18n";
import { router, setPathname } from "@/test/navigation";
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
          <span>public navigation</span>
        </HeaderNavigation>
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

describe("admin header navigation", () => {
  it("marks the current section", async () => {
    setPathname("/en/admin/usage");
    await renderNavigation(true);
    expect(screen.getByRole("button", { name: "Usage" }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(screen.getByRole("button", { name: "Layers" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Ecuador")).toBeTruthy();
    expect(screen.queryByText("public navigation")).toBeNull();
  });

  it("marks layers on a layer's page", async () => {
    setPathname("/admin/layers/3");
    await renderNavigation(true);
    expect(
      screen.getByRole("button", { name: "Layers" }).getAttribute("aria-current")
    ).toBe("page");
  });

  it("goes to the usage page", async () => {
    setPathname("/en/admin/layers");
    await renderNavigation(true);
    fireEvent.click(screen.getByRole("button", { name: "Usage" }));
    expect(router.push).toHaveBeenCalledWith("/en/admin/usage");
  });

  it("shows no sections before login", async () => {
    setPathname("/en/admin");
    await renderNavigation(false);
    expect(screen.queryByRole("button", { name: "Usage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Layers" })).toBeNull();
  });

  it("keeps the public navigation outside the admin", async () => {
    setPathname("/en/home");
    await renderNavigation(true);
    expect(screen.getByText("public navigation")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Usage" })).toBeNull();
  });
});
