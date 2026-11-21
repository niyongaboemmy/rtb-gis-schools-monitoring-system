import { describe, expect, it } from "vitest";
import { tdmpRelayTarget } from "./tdmp-relay";

describe("tdmpRelayTarget", () => {
  it("hands TDMP's callback to the API with TDMP's query", () => {
    expect(tdmpRelayTarget("/auth/tdmp/callback", "?code=abc&state=xyz", "/api/v1")).toBe(
      "/api/v1/auth/tdmp/callback?code=abc&state=xyz",
    );
  });

  it("hands the launch path to the API, also with a trailing slash", () => {
    expect(tdmpRelayTarget("/auth/tdmp/start/", "", "https://api.example/api/v1/")).toBe(
      "https://api.example/api/v1/auth/tdmp/start",
    );
  });

  it("leaves every other page alone", () => {
    expect(tdmpRelayTarget("/sso/tdmp", "?school=1", "/api/v1")).toBeNull();
    expect(tdmpRelayTarget("/auth/tdmp/callbackx", "", "/api/v1")).toBeNull();
    expect(tdmpRelayTarget("/login", "", "/api/v1")).toBeNull();
  });
});
