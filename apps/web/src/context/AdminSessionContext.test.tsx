import { useContext, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  createAdminSession,
  getAdminSession,
} from "@/api/adminLayers";
import type { AdminSession } from "@/interfaces/AdminLayer";
import { router } from "@/test/navigation";
import { AdminSessionContext, AdminSessionProvider } from "./AdminSessionContext";

vi.mock("@/api/adminLayers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/adminLayers")>()),
  createAdminSession: vi.fn(),
  getAdminSession: vi.fn(),
}));

const STORAGE_KEY = "monbo.adminSession";
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const sessionExpiringIn = (ms: number): AdminSession => ({
  token: "token-123",
  expiresAt: new Date(Date.now() + ms).toISOString(),
  country: "CR",
});

const renderSession = (locale = "es") =>
  renderHook(() => useContext(AdminSessionContext), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AdminSessionProvider locale={locale}>{children}</AdminSessionProvider>
    ),
  });

/** Renders with no stored session and logs in with `session`. */
const loggedIn = async (session: AdminSession, locale = "es") => {
  vi.mocked(createAdminSession).mockResolvedValue(session);
  const rendered = renderSession(locale);
  await act(() => rendered.result.current.login("passkey"));
  return rendered;
};

describe("AdminSessionProvider expiry", () => {
  it("ends a session at its expiry, not before", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { result } = await loggedIn(sessionExpiringIn(60 * MINUTE));

    await act(() => vi.advanceTimersByTimeAsync(59 * MINUTE));
    expect(result.current.session).not.toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(MINUTE));
    expect(result.current.session).toBeNull();
  });

  it("keeps a session longer than the maximum timer delay until it expires", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { result } = await loggedIn(sessionExpiringIn(30 * DAY));

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.session).not.toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(DAY));
    expect(result.current.session).not.toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(29 * DAY));
    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("AdminSessionProvider restoring a stored session", () => {
  const store = (value: string) => sessionStorage.setItem(STORAGE_KEY, value);

  it("is ready at once without a stored session", async () => {
    const { result } = renderSession();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.session).toBeNull();
    expect(getAdminSession).not.toHaveBeenCalled();
  });

  it("re-checks a stored token and takes the API's country", async () => {
    const stored = sessionExpiringIn(30 * MINUTE);
    store(JSON.stringify(stored));
    vi.mocked(getAdminSession).mockResolvedValue({
      expiresAt: stored.expiresAt,
      country: "PE",
    });

    const { result } = renderSession();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(getAdminSession).toHaveBeenCalledWith("token-123");
    expect(result.current.session).toEqual({ ...stored, country: "PE" });
  });

  it("drops an expired token without asking the API", async () => {
    store(JSON.stringify(sessionExpiringIn(-MINUTE)));

    const { result } = renderSession();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.session).toBeNull();
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("drops an unreadable stored value", async () => {
    store("{not json");

    const { result } = renderSession();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("drops a token the API rejects", async () => {
    store(JSON.stringify(sessionExpiringIn(30 * MINUTE)));
    vi.mocked(getAdminSession).mockRejectedValue(new AdminApiError(401, "Invalid token"));

    const { result } = renderSession();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("AdminSessionProvider login and logout", () => {
  it("stores the session on login and removes it on logout", async () => {
    const session = sessionExpiringIn(60 * MINUTE);
    const { result } = await loggedIn(session);

    expect(createAdminSession).toHaveBeenCalledWith("passkey");
    expect(result.current.session).toEqual(session);
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)).toEqual(session);

    act(() => result.current.logout());

    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("keeps no session when the passkey is rejected", async () => {
    vi.mocked(createAdminSession).mockRejectedValue(new AdminApiError(401, "Invalid passkey"));
    const { result } = renderSession();

    await expect(
      act(() => result.current.login("wrong"))
    ).rejects.toBeInstanceOf(AdminApiError);
    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("AdminSessionProvider withToken", () => {
  it("passes the token to the call and returns its result", async () => {
    const { result } = await loggedIn(sessionExpiringIn(60 * MINUTE));
    const call = vi.fn().mockResolvedValue(["layer"]);

    await expect(result.current.withToken(call)).resolves.toEqual(["layer"]);
    expect(call).toHaveBeenCalledWith("token-123");
  });

  it.each([
    ["es", "/admin"],
    ["en", "/en/admin"],
  ])("sends a visitor without a session to the login (%s)", async (locale, path) => {
    const { result } = renderSession(locale);
    await waitFor(() => expect(result.current.ready).toBe(true));
    const call = vi.fn();

    await expect(result.current.withToken(call)).rejects.toMatchObject({ status: 401 });
    expect(call).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(path);
  });

  it("signs out and goes to the login on a 401", async () => {
    const { result } = await loggedIn(sessionExpiringIn(60 * MINUTE), "en");
    const expired = new AdminApiError(401, "Token expired");

    await act(() =>
      expect(result.current.withToken(() => Promise.reject(expired))).rejects.toBe(expired)
    );

    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/en/admin");
  });

  it("keeps the session on any other error", async () => {
    const { result } = await loggedIn(sessionExpiringIn(60 * MINUTE));
    const conflict = new AdminApiError(409, "Too late to cancel");

    await act(() =>
      expect(result.current.withToken(() => Promise.reject(conflict))).rejects.toBe(conflict)
    );

    expect(result.current.session).not.toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
