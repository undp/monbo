import { describe, expect, it } from "vitest";
import { NO_ROW_PROBLEMS, problemMessages } from "./rowProblems";

describe("problemMessages", () => {
  it("lists each other-country message once and first, then the errors in row order", () => {
    expect(
      problemMessages([
        { otherCountry: null, errors: ["fila 4: a"], missing: [] },
        { otherCountry: "Perú", errors: ["fila 5: b", "fila 5: c"], missing: [] },
        NO_ROW_PROBLEMS,
        { otherCountry: "Perú", errors: [], missing: [] },
        { otherCountry: "Brasil", errors: ["fila 7: d"], missing: [] },
      ])
    ).toEqual(["Perú", "Brasil", "fila 4: a", "fila 5: b", "fila 5: c", "fila 7: d"]);
  });

  it("has nothing to say about rows without problems", () => {
    expect(problemMessages([NO_ROW_PROBLEMS, NO_ROW_PROBLEMS])).toEqual([]);
  });
});
