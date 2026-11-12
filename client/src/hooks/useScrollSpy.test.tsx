import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useScrollSpy } from "./useScrollSpy";

function Spy({ snap = false }: { snap?: boolean }) {
  const active = useScrollSpy(["a", "b", "c"], { offset: 100, snapToEnd: snap });
  return (
    <>
      <p>active: {active}</p>
      <section id="a" />
      <section id="b" />
      <section id="c" />
    </>
  );
}

/** Places each section's top relative to the viewport. */
function place(tops: Record<string, number>) {
  for (const [id, top] of Object.entries(tops))
    vi.spyOn(document.getElementById(id)!, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);
}

const scroll = () =>
  act(async () => {
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });

afterEach(() => vi.restoreAllMocks());

describe("useScrollSpy", () => {
  it("follows the section that has scrolled under the header", async () => {
    render(<Spy />);
    place({ a: 0, b: 600, c: 1400 });
    await scroll();
    expect(screen.getByText("active: a")).toBeInTheDocument();
    place({ a: -700, b: 50, c: 800 });
    await scroll();
    expect(screen.getByText("active: b")).toBeInTheDocument();
  });

  it("selects the last section at the bottom of the page when asked", async () => {
    render(<Spy snap />);
    place({ a: -900, b: 20, c: 400 });
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 0, configurable: true });
    await scroll();
    expect(screen.getByText("active: c")).toBeInTheDocument();
  });
});
