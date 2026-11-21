import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/toast";

const post = vi.fn();
const patch = vi.fn();
vi.mock("../../lib/api", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
  apiErrorMessage: (err: { response?: { data?: { message?: string } } }, fallback: string) =>
    err?.response?.data?.message ?? fallback,
}));

import { UserFormModal, type ManagedRole, type ManagedUser } from "./UserFormModal";
import { missingScopeField } from "./user-scope";

const roles: ManagedRole[] = [
  { id: "r-viewer", name: "viewer", accessLevel: { name: "National" } },
  { id: "r-district", name: "district_officer", accessLevel: { name: "District" } },
];

function renderForm(props: Partial<React.ComponentProps<typeof UserFormModal>> = {}) {
  const onSuccess = vi.fn();
  render(
    <ToastProvider>
      <UserFormModal
        isOpen
        onClose={vi.fn()}
        onSuccess={onSuccess}
        editingUser={null}
        roles={roles}
        schools={[]}
        mode="tdmp-expected"
        {...props}
      />
    </ToastProvider>,
  );
  return { onSuccess };
}

/** Opens a RichDropdown by its current label and picks an option. */
function pick(current: string | RegExp, option: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name: current }));
  fireEvent.click(screen.getByRole("button", { name: option }));
}

describe("Add expected TDMP user", () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: { id: "new" } });
    patch.mockReset().mockResolvedValue({ data: {} });
  });

  it("posts the email, role and area to /users/tdmp", async () => {
    const { onSuccess } = renderForm();
    expect(screen.getByText("Add expected TDMP user")).toBeInTheDocument();
    expect(
      screen.getByText("They get this role and area the first time they sign in with TDMP using this email."),
    ).toBeInTheDocument();
    // No password choices for TDMP people.
    expect(screen.queryByText(/temporary password/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: " jean@rtb.gov.rw " } });
    pick(/choose a role/i, /district officer/i);
    pick(/^choose a province$/i, "Kigali City");
    pick(/^choose a district$/i, "Gasabo");
    fireEvent.click(screen.getByRole("button", { name: "Add expected user" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/users/tdmp", {
      email: "jean@rtb.gov.rw",
      roleId: "r-district",
      location: { province: "Kigali City", district: "Gasabo" },
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("refuses a scoped role without its area, and a missing role", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "jean@rtb.gov.rw" } });
    fireEvent.click(screen.getByRole("button", { name: "Add expected user" }));
    expect(await screen.findByText("Choose a role.")).toBeInTheDocument();

    pick(/choose a role/i, /district officer/i);
    fireEvent.click(screen.getByRole("button", { name: "Add expected user" }));
    expect(await screen.findByText("Choose a province for this role.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("explains an existing account", async () => {
    post.mockRejectedValue({ response: { status: 409, data: { message: "exists" } } });
    renderForm();
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "jean@rtb.gov.rw" } });
    pick(/choose a role/i, /viewer/i);
    fireEvent.click(screen.getByRole("button", { name: "Add expected user" }));
    expect(await screen.findByText("An account for jean@rtb.gov.rw already exists. Edit it instead.")).toBeInTheDocument();
  });
});

describe("Give access to a TDMP user", () => {
  const waitingUser: ManagedUser = {
    id: "u9",
    email: "aline@rtb.gov.rw",
    firstName: "Aline",
    lastName: "Mukamana",
    isActive: true,
    createdAt: "2026-11-20T08:00:00.000Z",
    role: null,
    location: { tier: "school" },
    authSource: "tdmp",
    accessPending: true,
  };

  beforeEach(() => patch.mockReset().mockResolvedValue({ data: {} }));

  it("sends only the role and area; name and email stay read-only", async () => {
    renderForm({ editingUser: waitingUser, grantAccess: true, mode: "default" });
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/first name/i)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: /send reset code/i })).not.toBeInTheDocument();

    pick(/choose a role/i, /viewer/i);
    fireEvent.click(screen.getByRole("button", { name: "Give access" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/users/u9", { roleId: "r-viewer", location: {} }));
  });

  it("keeps role and area read-only when TDMP sends them", () => {
    renderForm({
      editingUser: { ...waitingUser, accessPending: false, role: roles[0] },
      mode: "default",
      tdmpAccess: "tdmp",
    });
    expect(screen.getByText("Comes from TDMP at each sign-in.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});

describe("Give access to a Google self-registration", () => {
  // A first Google sign-in: local account, no role, waiting for an admin.
  const googleUser: ManagedUser = {
    id: "u7",
    email: "someone@gmail.com",
    firstName: "Some",
    lastName: "One",
    isActive: true,
    createdAt: "2026-11-21T08:00:00.000Z",
    role: null,
    location: { tier: "school" },
    authSource: "local",
    accessPending: true,
  };

  beforeEach(() => patch.mockReset().mockResolvedValue({ data: {} }));

  it("pre-selects no role and refuses to save until one is chosen", async () => {
    renderForm({ editingUser: googleUser, grantAccess: true, mode: "default" });
    // Never a silent default (the first role in the list could be an admin one).
    expect(screen.getByRole("button", { name: /choose a role/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Give access" }));
    expect(await screen.findByText("Choose a role.")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    pick(/choose a role/i, /viewer/i);
    fireEvent.click(screen.getByRole("button", { name: "Give access" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/users/u7", expect.objectContaining({ roleId: "r-viewer" })),
    );
  });
});

describe("missingScopeField", () => {
  it.each([
    ["national", {}, null],
    ["district", { province: "Kigali City" }, "Choose a district for this role."],
    ["district", { province: "Kigali City", district: "Gasabo" }, null],
    ["school", { province: "Kigali City", district: "Gasabo", sector: "Remera" }, "Choose a school for this role."],
  ])("%s %j → %s", (level, loc, expected) => {
    expect(missingScopeField(level, loc)).toBe(expected);
  });
});
