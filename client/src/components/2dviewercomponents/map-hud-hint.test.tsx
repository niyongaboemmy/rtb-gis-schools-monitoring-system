import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MapHud } from "./MapHud";
import { createMapHudStore } from "./map-hud-store";

const renderHud = () => {
  const hud = createMapHudStore({ lat: -1.96, lng: 30.55 });
  render(<MapHud school={null} setShowBasicInfo={() => {}} hud={hud} isLoading={false} infoFeature={null} onCloseInfo={() => {}} />);
  return hud;
};
const flush = () => act(() => new Promise((r) => setTimeout(r, 40)));

describe("Full detail hint", () => {
  it("shows when zoomed past the photos' detail, and gives way to the loading pill", async () => {
    const hud = renderHud();
    expect(screen.queryByText(/Full detail/)).toBeNull();
    act(() => hud.setPastFullDetail(true));
    await flush();
    expect(screen.getByText(/Full detail · zooming further only enlarges/)).toBeTruthy();
    // Imagery loading takes the same spot.
    act(() => hud.setTilesLoading(true));
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(screen.getByText("Loading imagery")).toBeTruthy();
    // The hint leaves (after its exit animation).
    await waitFor(() => expect(screen.queryByText(/Full detail/)).toBeNull(), { timeout: 2000 });
  });
});
