import { describe, expect, it } from "vitest";
import { getOpenOpnameAgePriority } from "./opnameSessionAgePriority";

describe("getOpenOpnameAgePriority", () => {
  it("marks the absence of unresolved sessions distinctly", () => {
    expect(getOpenOpnameAgePriority(null)).toMatchObject({ tone: "empty", label: "Tidak ada sesi terbuka" });
  });

  it("classifies ages from zero through two days as controlled", () => {
    expect(getOpenOpnameAgePriority(0).tone).toBe("normal");
    expect(getOpenOpnameAgePriority(2).tone).toBe("normal");
  });

  it("uses warning for three to six days and critical from seven days", () => {
    expect(getOpenOpnameAgePriority(3)).toMatchObject({ tone: "warning", label: "Perlu perhatian" });
    expect(getOpenOpnameAgePriority(6).tone).toBe("warning");
    expect(getOpenOpnameAgePriority(7)).toMatchObject({ tone: "critical", label: "Mendesak" });
  });
});
