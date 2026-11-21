import { beforeEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

const render = (ui: ReactElement) => rtlRender(<MemoryRouter initialEntries={["/embed/schools/s1/dashboard"]}>{ui}</MemoryRouter>);

const axiosPost = vi.fn();
vi.mock("axios", () => ({ default: { post: (...a: unknown[]) => axiosPost(...a), create: () => ({ interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } }) } }));
let linkToken: string | null = "signed.link.token";
// The page's one shared embed session (lib/embed keeps it per page load).
let embSession: { view: string; drill?: string[] } | null = null;
vi.mock("../lib/embed", () => ({
  get EMBED_LINK_TOKEN() {
    return linkToken;
  },
  EMBED_EXPIRED_EVENT: "rtb:embed-expired",
  isEmbedLinkMode: () => linkToken !== null,
  memoryOnlyStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  ensureEmbedSession: (exchange: (t: string) => Promise<{ view: string }>) =>
    exchange(linkToken ?? "").then((s) => {
      embSession = s;
      return s;
    }),
  currentEmbedSession: () => embSession,
  isEmbedExpired: () => false,
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
  embSession = null;
  useAuthStore.setState({ token: null, user: null, isAuthenticated: false, status: "ready" });
  localStorage.clear();
});

describe("EmbedGate", () => {
  it("exchanges the signed link and shows the view, without touching saved storage", async () => {
    axiosPost.mockResolvedValue({ data: { accessToken: "embed.access", user: partnerUser, expiresIn: 7200 } });
    render(<EmbedGate view="school-dashboard" need={Permission.VIEW_INTELLIGENCE}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("the view")).toBeInTheDocument();
    expect(axiosPost).toHaveBeenCalledWith("/api/v1/embed/session", { token: "signed.link.token" });
    expect(useAuthStore.getState().token).toBe("embed.access");
    expect(localStorage.getItem("rtb-auth-storage") ?? "").not.toContain("embed viewer");
  });

  it("explains an expired or revoked link", async () => {
    axiosPost.mockRejectedValue({ response: { data: { code: "EMBED_LINK_REVOKED" } } });
    render(<EmbedGate view="school-dashboard" need={Permission.VIEW_INTELLIGENCE}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("Access was withdrawn")).toBeInTheDocument();
    expect(screen.queryByText("the view")).not.toBeInTheDocument();
  });

  it("refuses a view the session's role does not include", async () => {
    axiosPost.mockResolvedValue({ data: { accessToken: "t", user: partnerUser, expiresIn: 7200 } });
    render(<EmbedGate view="school-dashboard" need={Permission.MANAGE_USERS}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("No access to this view")).toBeInTheDocument();
  });

  it("opened without a link, asks a signed-out visitor to sign in", async () => {
    linkToken = null;
    render(<EmbedGate view="school-dashboard" need={Permission.VIEW_INTELLIGENCE}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("Sign in to RTB 3D GIS")).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("opened without a link, uses the signed-in session", async () => {
    linkToken = null;
    useAuthStore.setState({ token: "t", user: partnerUser as never, isAuthenticated: true, status: "ready" });
    render(<EmbedGate view="school-dashboard" need={Permission.SCHOOL_VIEW_2D3D_MAP}><div>the view</div></EmbedGate>);
    await waitFor(() => expect(screen.getByText("the view")).toBeInTheDocument());
  });
});

describe("EmbedGate keeps the iframe on its one view", () => {
  it("shows 'Not part of this view' if something inside navigates away, with a way back", async () => {
    const { useNavigate } = await import("react-router-dom");
    axiosPost.mockResolvedValue({ data: { accessToken: "t", user: partnerUser, expiresIn: 7200 } });
    function GoElsewhere() {
      const nav = useNavigate();
      return <button onClick={() => nav("/schools/s1/3d-explorer")}>open 3D</button>;
    }
    const { fireEvent } = await import("@testing-library/react");
    render(<EmbedGate view="school-dashboard" need={Permission.VIEW_INTELLIGENCE}><GoElsewhere /></EmbedGate>);
    fireEvent.click(await screen.findByRole("button", { name: "open 3D" }));
    expect(await screen.findByText("Not part of this view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back to the view/ }));
    expect(await screen.findByRole("button", { name: "open 3D" })).toBeInTheDocument();
  });

  it("tells the components inside which view they are", async () => {
    const { useEmbedView } = await import("../lib/embed-view");
    axiosPost.mockResolvedValue({ data: { accessToken: "t", user: partnerUser, expiresIn: 7200 } });
    function Probe() {
      return <span>view: {useEmbedView()}</span>;
    }
    render(<EmbedGate view="school-map-2d" need={Permission.SCHOOL_VIEW_2D3D_MAP}><Probe /></EmbedGate>);
    expect(await screen.findByText("view: school-map-2d")).toBeInTheDocument();
  });
  it("shows which area the view is limited to", async () => {
    axiosPost.mockResolvedValue({
      data: { accessToken: "t", user: { ...partnerUser, role: { ...partnerUser.role, permissions: [Permission.VIEW_MAP] }, location: { tier: "district", province: "Southern Province", district: "Muhanga" } }, expiresIn: 7200 },
    });
    render(<EmbedGate view="national-map" need={Permission.VIEW_MAP}><div>the view</div></EmbedGate>);
    expect(await screen.findByText("Showing: Muhanga District")).toBeInTheDocument();
  });
});

describe("a school opened from the embedded national map", () => {
  const mapUser = {
    ...partnerUser,
    role: { ...partnerUser.role, permissions: [Permission.VIEW_MAP, Permission.SCHOOL_VIEW_2D3D_MAP] },
    location: { tier: "district", province: "Southern Province", district: "Huye" },
  };
  const signedIn = (session: { view: string; drill?: string[] }) => {
    embSession = session;
    useAuthStore.setState({ token: "t", user: mapUser as never, isAuthenticated: true, status: "ready" });
  };
  const at = (path: string, ui: ReactElement) => rtlRender(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

  it("reuses the map's session, shows a way back and only the views the link allows", async () => {
    signedIn({ view: "national-map", drill: ["school-map-2d", "school-map-3d"] });
    at("/embed/schools/s9/map-2d", <EmbedGate view="school-map-2d" need={Permission.SCHOOL_VIEW_2D3D_MAP}><div>the map</div></EmbedGate>);
    expect(await screen.findByText("the map")).toBeInTheDocument();
    expect(axiosPost).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Map/ })).toHaveAttribute("href", "/embed/map");
    expect(screen.getByRole("link", { name: "3D model" })).toHaveAttribute("href", "/embed/schools/s9/map-3d");
    expect(screen.getByRole("link", { name: "2D map" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("school links inside the map stay in the iframe, only for views the link allows", async () => {
    const { useSchoolLink } = await import("../lib/embed-view");
    signedIn({ view: "national-map", drill: ["school-map-3d"] });
    function Links() {
      const l = useSchoolLink();
      return (
        <>
          <span>3d: {l.href("s9", "map-3d") ?? "none"}</span>
          <span>overview: {l.href("s9", "dashboard") ?? "none"}</span>
          <span>open: {l.hrefOrFallback("s9", "dashboard") ?? "none"}</span>
        </>
      );
    }
    at("/embed/map", <EmbedGate view="national-map" need={Permission.VIEW_MAP}><Links /></EmbedGate>);
    expect(await screen.findByText("3d: /embed/schools/s9/map-3d")).toBeInTheDocument();
    expect(screen.getByText("overview: none")).toBeInTheDocument();
    expect(screen.getByText("open: /embed/schools/s9/map-3d")).toBeInTheDocument();
  });

  it("when the link allows no school view, a school opens in RTB GIS in a new tab", async () => {
    const { useSchoolLink } = await import("../lib/embed-view");
    signedIn({ view: "national-map" });
    function Links() {
      const t = useSchoolLink().open({ id: "s9", code: "TSS-SOU-001" }, "dashboard");
      const none = useSchoolLink().open({ id: "s9" }, "dashboard");
      return (
        <>
          <span>to: {t?.to}</span>
          <span>new tab: {String(t?.newTab)}</span>
          <span>no code: {none === null ? "none" : "link"}</span>
        </>
      );
    }
    at("/embed/map", <EmbedGate view="national-map" need={Permission.VIEW_MAP}><Links /></EmbedGate>);
    expect(await screen.findByText(`to: ${window.location.origin}/sso/tdmp?school=TSS-SOU-001`)).toBeInTheDocument();
    expect(screen.getByText("new tab: true")).toBeInTheDocument();
    expect(screen.getByText("no code: none")).toBeInTheDocument();
  });

  it("a school view opened from its own link has no back bar", async () => {
    signedIn({ view: "school-map-2d" });
    at("/embed/schools/s9/map-2d", <EmbedGate view="school-map-2d" need={Permission.SCHOOL_VIEW_2D3D_MAP}><div>the map</div></EmbedGate>);
    expect(await screen.findByText("the map")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "School views" })).not.toBeInTheDocument();
  });
});
