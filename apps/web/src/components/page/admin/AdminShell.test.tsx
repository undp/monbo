import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { createTestI18n } from "@/test/i18n";
import { router, setPathname } from "@/test/navigation";
import { AdminShell } from "./AdminShell";

const session = { token: "t", expiresAt: "2099-01-01T00:00:00Z", country: "EC" };

const renderShell = async (signedIn = true, logout = vi.fn()) => {
  const i18n = await createTestI18n("en");
  render(
    <I18nextProvider i18n={i18n}>
      <AdminSessionContext.Provider
        value={{
          session: signedIn ? session : null,
          ready: true,
          login: vi.fn(),
          logout,
          withToken: vi.fn(),
        }}
      >
        <AdminShell>
          <p>page content</p>
        </AdminShell>
      </AdminSessionContext.Provider>
    </I18nextProvider>
  );
};

// Below 900 px the sidebar hides; jsdom applies no media query, so it counts as
// hidden for the accessibility tree.
const sidebar = () =>
  within(screen.getByRole("navigation", { name: "Admin", hidden: true }));
const currentOf = (name: string) =>
  sidebar().getByRole("link", { name, hidden: true }).getAttribute("aria-current");

describe("AdminShell", () => {
  it("shows the session's country and the sections beside the page", async () => {
    setPathname("/en/admin/categories/protected_areas");
    await renderShell();

    expect(screen.getByText("page content")).toBeTruthy();
    expect(screen.getByText("Admin session")).toBeTruthy();
    expect(screen.getByText("Ecuador")).toBeTruthy();
    expect(
      sidebar()
        .getAllByRole("link", { hidden: true })
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Layers", "/en/admin/layers"],
      ["Categories", "/en/admin/categories"],
      ["Usage", "/en/admin/usage"],
    ]);
    expect(currentOf("Categories")).toBe("page");
    expect(currentOf("Layers")).toBeNull();
  });

  it("logs out from the sidebar", async () => {
    setPathname("/en/admin/layers");
    const logout = vi.fn();
    await renderShell(true, logout);

    fireEvent.click(screen.getByRole("button", { name: "Log out", hidden: true }));

    expect(logout).toHaveBeenCalledOnce();
    expect(router.replace).toHaveBeenCalledWith("/en/admin");
  });

  it("sends a visitor without a session to the login", async () => {
    setPathname("/en/admin/usage");
    await renderShell(false);

    expect(router.replace).toHaveBeenCalledWith("/en/admin");
    expect(screen.queryByText("page content")).toBeNull();
    expect(screen.queryByText("Admin session")).toBeNull();
  });
});
