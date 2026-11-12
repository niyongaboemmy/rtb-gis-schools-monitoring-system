import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const axiosPost = vi.fn();
vi.mock("axios", () => ({ default: { post: (...a: unknown[]) => axiosPost(...a), create: () => ({ interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } }) } }));
let linkToken: string | null = "signed.link.token";
vi.mock("../lib/embed", () => ({
  get EMBED_LINK_TOKEN() {
    return linkToken;
  },
  EMBED_EXPIRED_EVENT: "rtb:embed-expired",
  isEmbedLinkMode: () => linkToken !== null,
  memoryOnlyStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
}));
vi.mock("../lib/api", () => ({ API_BASE: "/api/v1", api: { get: vi.fn() } }));
vi.mock("./SchoolDecisionDashboard", () => ({ default: () => <div>dashboard</div> }));
vi.mock("./NationalMap", () => ({ default: () => <div>national map</div> }));
vi.mock("../components/SchoolMap", () => ({ default: () => <div>map</div> }));
vi.mock("../components/School3DView", () => ({ default: () => <div>3d</div> }));

import { EmbedGate } from "./Embed";
import { useAuthStore } from "../store/authStore";
import { Permission } from "../lib/permissions";

const partnerUser = {
  id: "svc", firstName: "TDMP", lastName: "embed viewer", email: "tdmp.x@partner.rtb-gis.invalid",
  role: { id: "r", name: "partner_viewer", permissions: [Permission.VIEW_INTELLIGENCE, Permission.SCHOOL_VIEW_2D3D_MAP] },
  location: { tier: "school", schoolId: "s1" },
};

beforeEach(() => {
  axiosPost.mockReset();
  linkToken = "signed.link.token";
  useAuthStore.setState({ token: null, user: null, isAuthenticated: false, status: "ready" });
  localStorage.clear();
});

describe("EmbedGate", () => {
  it("exchanges the signed link and shows the view, without touching saved storage", async () => {
    axiosPost.mockResolvedValue({ data: { accessToken: "embed.access", user: partnerUser, expiresIn: 7200 } });
    render(<EmbedGate need={Permission.VIEW_INTELLIGENCE}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("the view")).toBeInTheDocument();
    expect(axiosPost).toHaveBeenCalledWith("/api/v1/embed/session", { token: "signed.link.token" });
    expect(useAuthStore.getState().token).toBe("embed.access");
    expect(localStorage.getItem("rtb-auth-storage") ?? "").not.toContain("embed viewer");
  });

  it("explains an expired or revoked link", async () => {
    axiosPost.mockRejectedValue({ response: { data: { code: "EMBED_LINK_REVOKED" } } });
    render(<EmbedGate need={Permission.VIEW_INTELLIGENCE}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("Access was withdrawn")).toBeInTheDocument();
    expect(screen.queryByText("the view")).not.toBeInTheDocument();
  });

  it("refuses a view the session's role does not include", async () => {
    axiosPost.mockResolvedValue({ data: { accessToken: "t", user: partnerUser, expiresIn: 7200 } });
    render(<EmbedGate need={Permission.MANAGE_USERS}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("No access to this view")).toBeInTheDocument();
  });

  it("opened without a link, asks a signed-out visitor to sign in", async () => {
    linkToken = null;
    render(<EmbedGate need={Permission.VIEW_INTELLIGENCE}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("Sign in to RTB 3D GIS")).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("opened without a link, uses the signed-in session", async () => {
    linkToken = null;
    useAuthStore.setState({ token: "t", user: partnerUser as never, isAuthenticated: true, status: "ready" });
    render(<EmbedGate need={Permission.SCHOOL_VIEW_2D3D_MAP}><div>the view</div></EmbedGate>);
    await waitFor(() => expect(screen.getByText("the view")).toBeInTheDocument());
  });
});
