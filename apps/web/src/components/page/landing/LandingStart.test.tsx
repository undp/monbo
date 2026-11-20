import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeMapResults } from "@/test/factories";
import { renderLanding } from "@/test/renderLanding";
import { LandingStart } from "./LandingStart";

const env = vi.hoisted(() => ({ contactUrl: null as string | null }));
vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/env")>();
  return {
    ...actual,
    get CONTACT_URL() {
      return env.contactUrl;
    },
  };
});

const pills = () =>
  within(screen.getByRole("group", { name: "¿Dónde produces?" })).getAllByRole("button");
const pill = (name: string) => screen.getByRole("button", { name });
const startButton = () => screen.getByRole("button", { name: /^Empezar/ });

describe("LandingStart", () => {
  it("shows one pill per available country, by name, with its silhouette", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, { selectedCountry: "CO" });

    expect(pills().map((button) => button.textContent)).toEqual([
      "Colombia",
      "Costa Rica",
      "Ecuador",
    ]);
    for (const button of pills()) {
      expect(button.querySelector("svg path")?.getAttribute("d")).toMatch(/^M/);
    }
  });

  it("selects Colombia when the user arrives without a country", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />);

    expect(pill("Colombia").getAttribute("aria-pressed")).toBe("true");
    expect(startButton().textContent).toBe("Empezar en Colombia");
  });

  it("selects the first country when Colombia has no layers", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, {
      context: { availableCountries: ["EC", "CR"] },
    });

    expect(pill("Costa Rica").getAttribute("aria-pressed")).toBe("true");
  });

  it("changes the country and the button's label", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, { selectedCountry: "CO" });

    fireEvent.click(pill("Ecuador"));

    expect(pill("Ecuador").getAttribute("aria-pressed")).toBe("true");
    expect(pill("Colombia").getAttribute("aria-pressed")).toBe("false");
    expect(startButton().textContent).toBe("Empezar en Ecuador");
  });

  it("is usable with the keyboard: the pills are buttons", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, { selectedCountry: "CO" });

    const costaRica = pill("Costa Rica");
    costaRica.focus();
    expect(document.activeElement).toBe(costaRica);
    expect(costaRica.tagName).toBe("BUTTON");
  });

  it("starts the flow", async () => {
    const onStart = vi.fn();
    await renderLanding(<LandingStart onStart={onStart} />, { selectedCountry: "EC" });

    fireEvent.click(startButton());

    expect(onStart).toHaveBeenCalledOnce();
  });

  it("asks for a restart once an analysis exists", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, {
      selectedCountry: "CO",
      context: { territorialAnalysisResults: [makeMapResults(1, {})] },
    });

    fireEvent.click(pill("Ecuador"));

    expect(await screen.findByText("Cambiar de país reinicia el análisis")).toBeTruthy();
    // The open modal hides the page from the accessibility tree.
    expect(
      screen.getByRole("button", { name: "Colombia", hidden: true }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("shows a loading state until the countries arrive", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, {
      context: { availableCountriesLoaded: false, availableCountries: [] },
    });

    expect(screen.getByRole("group", { name: "¿Dónde produces?" }).getAttribute("aria-busy")).toBe(
      "true"
    );
    expect(startButton().hasAttribute("disabled")).toBe(true);
    expect(startButton().textContent).toBe("Empezar");
  });

  it("asks to reload when the countries can't be fetched", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, {
      context: {
        availableCountriesLoaded: false,
        availableCountriesError: true,
        availableCountries: [],
      },
    });

    expect(screen.getByRole("status").textContent).toBe(
      "No pudimos cargar los países. Recarga la página para intentarlo de nuevo."
    );
  });

  it("says when no country is available", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, {
      context: { availableCountries: [] },
    });

    expect(screen.getByRole("status").textContent).toBe(
      "Todavía no hay países disponibles."
    );
  });

  it("links to the contact URL when there is one", async () => {
    env.contactUrl = "mailto:monbo@example.org";
    await renderLanding(<LandingStart onStart={vi.fn()} />, { selectedCountry: "CO" });

    const link = screen.getByRole("link", { name: "¿Tu país no está? Escríbenos" });
    expect(link.getAttribute("href")).toBe("mailto:monbo@example.org");
    env.contactUrl = null;
  });

  it("hides the contact link without a contact URL", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, { selectedCountry: "CO" });

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("speaks English", async () => {
    await renderLanding(<LandingStart onStart={vi.fn()} />, {
      locale: "en",
      selectedCountry: "CR",
    });

    expect(screen.getByRole("button", { name: "Start in Costa Rica" })).toBeTruthy();
  });
});
