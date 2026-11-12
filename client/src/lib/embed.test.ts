import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.resetModules();
});

describe("embed link mode", () => {
  it("reads the token from the URL fragment of an /embed page and removes it", async () => {
    window.history.replaceState(null, "", "/embed/schools/s1/dashboard#token=abc.def.ghi");
    const m = await import("./embed");
    expect(m.EMBED_LINK_TOKEN).toBe("abc.def.ghi");
    expect(m.isEmbedLinkMode()).toBe(true);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/embed/schools/s1/dashboard");
  });

  it("is off elsewhere, even with a token-looking fragment", async () => {
    window.history.replaceState(null, "", "/schools#token=abc");
    const m = await import("./embed");
    expect(m.isEmbedLinkMode()).toBe(false);
  });

  it("memory storage keeps nothing", async () => {
    const m = await import("./embed");
    m.memoryOnlyStorage.setItem();
    expect(m.memoryOnlyStorage.getItem()).toBeNull();
  });
});
