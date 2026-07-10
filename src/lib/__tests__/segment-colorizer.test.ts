import { describe, it, expect } from "vitest";
import { colorizeSegments } from "../segment-colorizer";
import { straightLineNorth, LEIGHTON_BUZZARD } from "./helpers";

const northLine = straightLineNorth(LEIGHTON_BUZZARD, 10, 11);

describe("colorizeSegments", () => {
  it("produces one segment per coordinate pair", () => {
    const segments = colorizeSegments(northLine, 180, 10, false);
    expect(segments.length).toBe(northLine.length - 1);
  });

  it("southerly wind paints a northbound line as tailwind", () => {
    const segments = colorizeSegments(northLine, 180, 10, false);
    for (const seg of segments) {
      expect(seg.color).toBe("tailwind");
      expect(seg.tailwindComponent).toBeCloseTo(10, 1);
    }
  });

  it("northerly wind paints the same line as headwind", () => {
    const segments = colorizeSegments(northLine, 0, 10, false);
    for (const seg of segments) {
      expect(seg.color).toBe("headwind");
      expect(seg.tailwindComponent).toBeCloseTo(-10, 1);
    }
  });

  it("easterly wind paints it as crosswind", () => {
    const segments = colorizeSegments(northLine, 90, 10, false);
    for (const seg of segments) {
      expect(seg.color).toBe("crosswind");
      expect(Math.abs(seg.tailwindComponent)).toBeLessThan(0.5);
    }
  });

  it("reversed=true flips the direction of travel", () => {
    // Riding the north line reversed means heading south; a southerly
    // becomes a headwind.
    const segments = colorizeSegments(northLine, 180, 10, true);
    for (const seg of segments) {
      expect(seg.color).toBe("headwind");
    }
  });

  it("boundaries: <60 deg off the wind is tailwind, >120 is headwind", () => {
    // Segment bearing 0. Wind toward 59 deg => angle 59 => tailwind.
    expect(colorizeSegments(northLine, 239, 10, false)[0].color).toBe("tailwind");
    // Wind toward 61 deg => angle 61 => crosswind.
    expect(colorizeSegments(northLine, 241, 10, false)[0].color).toBe("crosswind");
    // Wind toward 121 deg => angle 121 => headwind.
    expect(colorizeSegments(northLine, 301, 10, false)[0].color).toBe("headwind");
  });

  it("does not mutate the input coordinates when reversed", () => {
    const copy = northLine.map((c) => ({ ...c }));
    colorizeSegments(northLine, 180, 10, true);
    expect(northLine).toEqual(copy);
  });
});
