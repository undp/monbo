import { vi } from "vitest";

// Stand-in for `next/navigation`, installed by setup.ts for every test. The router's
// methods are spies; the pathname, search params and route params are set per test.

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = "/";
let searchParams = new URLSearchParams();
let params: Record<string, string> = {};

/** The pathname `usePathname` returns from now on. */
export const setPathname = (next: string) => {
  pathname = next;
};

/** The search params `useSearchParams` returns from now on. */
export const setSearchParams = (init: Record<string, string>) => {
  searchParams = new URLSearchParams(init);
};

/** The route params `useParams` returns from now on. */
export const setParams = (next: Record<string, string>) => {
  params = next;
};

export const resetNavigation = () => {
  pathname = "/";
  searchParams = new URLSearchParams();
  params = {};
};

export const navigationMock = {
  useRouter: () => router,
  useSearchParams: () => searchParams,
  useParams: () => params,
  usePathname: () => pathname,
};
