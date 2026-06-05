import { describe, expect, it } from "vitest";
import { parseTranslatedPanels } from "./translate";

describe("parseTranslatedPanels", () => {
  it("parses a clean JSON array", () => {
    const raw = JSON.stringify([
      { id: "a", headline: "Hola", subheadline: "Mundo" },
      { id: "b", headline: "Adiós", subheadline: "Tierra" },
    ]);
    const panels = parseTranslatedPanels(raw);
    expect(panels).toHaveLength(2);
    expect(panels[0]).toEqual({
      id: "a",
      headline: "Hola",
      subheadline: "Mundo",
    });
  });

  it("unwraps a fenced code block", () => {
    const raw =
      '```json\n[{"id":"a","headline":"Bonjour","subheadline":"Le monde"}]\n```';
    const panels = parseTranslatedPanels(raw);
    expect(panels).toEqual([
      { id: "a", headline: "Bonjour", subheadline: "Le monde" },
    ]);
  });

  it("recovers an array embedded in prose", () => {
    const raw =
      'Here you go:\n[{"id":"x","headline":"Ciao","subheadline":"Mondo"}]\nHope it helps!';
    const panels = parseTranslatedPanels(raw);
    expect(panels).toEqual([
      { id: "x", headline: "Ciao", subheadline: "Mondo" },
    ]);
  });

  it("preserves embedded HTML highlight markup", () => {
    const raw = JSON.stringify([
      {
        id: "a",
        headline: 'Sigue tu <mark>progreso</mark>',
        subheadline: "Cada día",
      },
    ]);
    expect(parseTranslatedPanels(raw)[0].headline).toBe(
      "Sigue tu <mark>progreso</mark>",
    );
  });

  it("drops entries missing required string fields", () => {
    const raw = JSON.stringify([
      { id: "a", headline: "ok", subheadline: "ok" },
      { id: "b", headline: 42 },
      { headline: "no id", subheadline: "x" },
    ]);
    expect(parseTranslatedPanels(raw)).toHaveLength(1);
  });

  it("returns an empty array for non-JSON garbage", () => {
    expect(parseTranslatedPanels("sorry, I can't do that")).toEqual([]);
  });
});
