import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeFarm } from "@/test/factories";
import { router } from "@/test/navigation";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { useModuleRouter } from "./useModuleRouter";

describe("useModuleRouter", () => {
  it("does nothing without a path", async () => {
    const { result } = await renderHookWithData(() => useModuleRouter());

    act(() => result.current());

    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(["/", "/home"])("goes to %s directly", async (path) => {
    const { result } = await renderHookWithData(() => useModuleRouter(path));

    act(() => result.current());

    expect(router.push).toHaveBeenCalledWith(path);
  });

  it("sends a module without data to its upload page", async () => {
    const { result } = await renderHookWithData(() => useModuleRouter("/polygons-validation"));

    act(() => result.current());

    expect(router.push).toHaveBeenCalledWith("/polygons-validation/upload-data");
  });

  it("goes to the module when farms are loaded", async () => {
    const { result } = await renderHookWithData(() => useModuleRouter("/polygons-validation"), {
      context: makeDataContext({ farmsData: [makeFarm()] }),
    });

    act(() => result.current());

    expect(router.push).toHaveBeenCalledWith("/polygons-validation");
  });

  it("uses the farms loaded after the first render", async () => {
    const rendered = await renderHookWithData(() =>
      useModuleRouter("/deforestation-analysis")
    );
    rendered.setContext(makeDataContext({ farmsData: [makeFarm()] }));
    rendered.rerender(undefined);

    act(() => rendered.result.current());

    expect(router.push).toHaveBeenCalledWith("/deforestation-analysis");
  });
});
