import { useState, useEffect, useRef, useMemo } from "react";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast, notify } from "../ui/toast";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { SearchInput } from "../ui/search-input";
import { RichDropdown } from "../ui/rich-dropdown";
import { StatusPill } from "../ui/status-pill";
import { PILL_BUTTON } from "../ui/surfaces";
import { FloatingStat } from "../dashboard/FloatingStat";
import { Pagination } from "../report-review/Pagination";
import { UserFormModal, type ManagedRole, type ManagedUser, type UserLocation } from "../users/UserFormModal";
import { BulkUploadModal } from "../users/BulkUploadModal";
import { DeleteConfirmationModal } from "../ui/delete-confirmation-modal";
import { useAuthStore } from "../../store/authStore";
import { useSchoolsStore } from "../../store/schoolsStore";
import { resolveDistrictName, resolveProvinceName } from "../../lib/rwanda-locations";
import {
  Send,
  SearchX,
  Plus,
  Eye,
  Trash2,
  Edit2,
  MapPin,
  UploadCloud,
  Layers,
  Users2,
  UserCheck,
  UserX,
  ShieldCheck,
  KeyRound,
  CalendarPlus,
  LogIn,
  CircleDot,
} from "lucide-react";
import { formatDate, formatDateTime, formatNumber } from "../../lib/format";
import { titleCase } from "../../lib/labels";
import {
  SettingsPanel,
  Toolbar,
  Initials,
  PersonIcon,
  HeroStats,
  IconAction,
  DataTable,
  Th,
  Tr,
  Td,
  CardList,
  CardItem,
  ListSkeleton,
  EmptyNote,
  FactRow,
} from "./settings-ui";

const PAGE_SIZE = 10;

type StatusFilter = "active" | "inactive" | "all";
const DEFAULT_STATUS: StatusFilter = "active";

/** "Gasabo, Kigali City" style label for a user's location scope, or null. */
function scopeLocation(loc: UserLocation | null | undefined): string | null {
  if (!loc || Object.keys(loc).length === 0) return null;
  if (loc.schoolName) return loc.schoolName;
  if (loc.sector) return `${loc.sector}, ${resolveDistrictName(loc.district)}`;
  if (loc.district) return `${resolveDistrictName(loc.district)}, ${resolveProvinceName(loc.province)}`;
  if (loc.province) return resolveProvinceName(loc.province);
  return null;
}

function fullName(u: ManagedUser): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

function ActiveStatus({ active }: { active: boolean }) {
  return active ? <StatusPill tone="good">Active</StatusPill> : <StatusPill tone="neutral">Deactivated</StatusPill>;
}

function RoleChip({ role }: { role: ManagedRole | null | undefined }) {
  return role?.name ? (
    <StatusPill tone="primary" dot={false}>
      {titleCase(role.name)}
    </StatusPill>
  ) : (
    <StatusPill tone="neutral" dot={false}>
      No role
    </StatusPill>
  );
}

/** 2FA / pending-password markers next to the email. */
function SecurityMarkers({ user }: { user: ManagedUser }) {
  if (!user.totpEnabled && !user.mustChangePassword) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {user.totpEnabled && (
        <span
          title="Two-factor authentication on"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/12 text-success"
        >
          <ShieldCheck className="h-3 w-3" aria-hidden />
          <span className="sr-only">Two-factor authentication on</span>
        </span>
      )}
      {user.mustChangePassword && (
        <span
          title="Must set a new password at next sign-in"
          className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-1.5 py-0.5 text-[12px] font-medium text-warning"
        >
          <KeyRound className="h-3 w-3" aria-hidden />
          Password pending
        </span>
      )}
    </span>
  );
}

function ScopeCell({ user }: { user: ManagedUser }) {
  const lvl: string | undefined = user.role?.accessLevel?.name;
  if (!lvl) return <span className="text-xs text-muted-foreground/70">National</span>;
  const loc = scopeLocation(user.location);
  // One line ("District · Gasabo, Kigali City") so rows stay short.
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs" title={loc ? `${titleCase(lvl)} · ${loc}` : titleCase(lvl)}>
      <Layers className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
      <span className="shrink-0 font-normal text-foreground">{titleCase(lvl)}</span>
      {loc && (
        <>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="truncate text-muted-foreground">{loc}</span>
        </>
      )}
    </span>
  );
}

export function UsersTab() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [loading, setLoading] = useState(true);

  const { allSchools, fetchAllSchools } = useSchoolsStore();

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  // Deactivated accounts are hidden by default; they stay one click away.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [previewUser, setPreviewUser] = useState<ManagedUser | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<{ id: string; name: string } | null>(null);

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const setAL = (key: string, val: boolean) => setActionLoading((prev) => ({ ...prev, [key]: val }));
  const isAL = (key: string) => actionLoading[key] === true;

  const { user: currentUser } = useAuthStore();
  const toast = useToast();
  const fetchPromise = useRef<Promise<void> | null>(null);

  useEffect(() => {
    fetchInitialData();
    fetchAllSchools();
  }, [fetchAllSchools]);

  const fetchInitialData = async () => {
    if (fetchPromise.current) return fetchPromise.current;

    setLoading(true);

    fetchPromise.current = Promise.all([api.get("/users"), api.get("/roles")])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes.data);
        setRoles(rolesRes.data);
      })
      .catch((err) => {
        console.error("Failed to load initial data", err);
        notify.error(apiErrorMessage(err, "Could not load users."));
      })
      .finally(() => {
        setLoading(false);
        fetchPromise.current = null;
      });

    return fetchPromise.current;
  };

  const handleDeleteUser = async (id: string, name: string) => {
    const key = `del-user-${id}`;
    setAL(key, true);
    try {
      await api.delete(`/users/${id}`);
      setPendingDeactivate(null);
      fetchInitialData();
      toast.success(`User "${name}" deactivated and signed out`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not deactivate ${name}.`));
    } finally {
      setAL(key, false);
    }
  };

  /** Emails the user a one-time code to set a new password (WS10.4). */
  const handleSendReset = async (id: string, email: string) => {
    const key = `reset-user-${id}`;
    setAL(key, true);
    try {
      const { data } = await api.post<{ delivered: boolean }>(`/users/${id}/send-reset`);
      if (data.delivered) toast.success(`A reset code was emailed to ${email}.`);
      else toast.warning("Email is disabled on this server; the code was written to the server log.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send the reset code."));
    } finally {
      setAL(key, false);
    }
  };

  const roleOptions = roles.map((role) => ({
    label: titleCase(role.name),
    value: role.id,
  }));

  const term = searchTerm.toLowerCase();
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(term) ||
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term);
    const matchesRole = roleFilter === "all" || u.role?.id === roleFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active") === !!u.isActive;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Clamp: a shrinking result set (filter, deactivation refresh) never strands
  // the view on an empty page.
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = searchTerm.trim() !== "" || roleFilter !== "all" || statusFilter !== DEFAULT_STATUS;
  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter(DEFAULT_STATUS);
    setCurrentPage(1);
  };

  const overview = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const rolesInUse = new Set(users.map((u) => u.role?.id).filter(Boolean)).size;
    return { total, active, deactivated: total - active, rolesInUse };
  }, [users]);

  const share = (n: number, of: number) => (of > 0 ? (n / of) * 100 : null);
  const fmt = (n: number | null) => formatNumber(n);

  const openEdit = (u: ManagedUser) => {
    setEditingUser(u);
    setIsModalOpen(true);
  };

  const rowActions = (u: ManagedUser) => (
    <>
      <IconAction label={`View ${u.firstName} ${u.lastName}`} icon={Eye} onClick={() => setPreviewUser(u)} />
      <IconAction label={`Edit ${u.firstName} ${u.lastName}`} icon={Edit2} onClick={() => openEdit(u)} />
      <IconAction
        label={`Send ${u.email} a password reset code`}
        icon={Send}
        disabled={!u.isActive}
        loading={isAL(`reset-user-${u.id}`)}
        onClick={() => void handleSendReset(u.id, u.email)}
      />
      <IconAction
        label={`Deactivate ${u.email}`}
        icon={Trash2}
        tone="danger"
        disabled={u.id === currentUser?.id || !u.isActive}
        loading={isAL(`del-user-${u.id}`)}
        onClick={() => setPendingDeactivate({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })}
      />
    </>
  );

  const previewScope = previewUser ? scopeLocation(previewUser.location) : null;

  return (
    <div className="space-y-5">
      <HeroStats>
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 @4xl:grid-cols-4">
        <FloatingStat flat
          compact
          depth
          index={0}
          label="Total users"
          caption="all accounts"
          value={loading ? null : overview.total}
          format={fmt}
          icon={Users2}
          tone="text-primary"
          color="#3b82f6"
        />
        <FloatingStat flat
          compact
          depth
          index={1}
          label="Active"
          caption="can sign in"
          value={loading ? null : overview.active}
          format={fmt}
          percent={loading ? null : share(overview.active, overview.total)}
          icon={UserCheck}
          tone="text-success"
          color="#10b981"
        />
        <FloatingStat flat
          compact
          depth
          index={2}
          label="Deactivated"
          caption="sign-in blocked"
          value={loading ? null : overview.deactivated}
          format={fmt}
          percent={loading ? null : share(overview.deactivated, overview.total)}
          icon={UserX}
          tone="text-destructive"
          color="#ef4444"
        />
        <FloatingStat flat
          compact
          depth
          index={3}
          label="Roles in use"
          caption={`of ${formatNumber(roles.length)} roles`}
          value={loading ? null : overview.rolesInUse}
          format={fmt}
          percent={loading ? null : share(overview.rolesInUse, roles.length)}
          icon={ShieldCheck}
          tone="text-violet-500 dark:text-violet-400"
          color="#8b5cf6"
        />
      </dl>
      </HeroStats>

      <SettingsPanel
        index={1}
        flush
        title="Users"
        subtitle="Accounts, roles and scope"
        icon={Users2}
        actions={
          <>
            <Button variant="outline" className={PILL_BUTTON.secondary} onClick={() => setIsUploadModalOpen(true)}>
              <UploadCloud className="h-4 w-4" aria-hidden /> Import users
            </Button>
            <Button
              className={PILL_BUTTON.primary}
              onClick={() => {
                setEditingUser(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add user
            </Button>
          </>
        }
        toolbar={
          <Toolbar>
            <SearchInput
              placeholder="Search by name or email"
              aria-label="Search users"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              onClear={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              containerClassName="@3xl:w-72"
            />
            <RichDropdown
              options={[{ label: "All roles", value: "all" }, ...roleOptions]}
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val as string);
                setCurrentPage(1);
              }}
              className="@3xl:w-56"
            />
            <RichDropdown
              options={[
                { label: `Active (${overview.active})`, value: "active" },
                { label: `Deactivated (${overview.deactivated})`, value: "inactive" },
                { label: `All statuses (${overview.total})`, value: "all" },
              ]}
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val as StatusFilter);
                setCurrentPage(1);
              }}
              className="@3xl:w-52"
            />
          </Toolbar>
        }
      >
        {loading ? (
          <ListSkeleton rows={PAGE_SIZE} label="Loading users…" />
        ) : paginatedUsers.length === 0 ? (
          <EmptyNote
            icon={SearchX}
            title={hasFilters ? "No users match these filters" : "No users yet"}
            hint={hasFilters ? "Try another name, email, role or status." : "Add a user or import a spreadsheet."}
            action={
              hasFilters ? (
                <Button variant="outline" className={PILL_BUTTON.small} onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable label="Users">
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Scope</Th>
                  <Th>Status</Th>
                  <Th>Added</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-2.5" title={u.email}>
                        <PersonIcon className="h-7 w-7" />
                        <p className="truncate text-[15px] leading-5 text-foreground">
                          {u.firstName} {u.lastName}
                        </p>
                        <SecurityMarkers user={u} />
                      </div>
                    </Td>
                    <Td>
                      <RoleChip role={u.role} />
                    </Td>
                    <Td className="max-w-56">
                      <ScopeCell user={u} />
                    </Td>
                    <Td>
                      <ActiveStatus active={!!u.isActive} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatDate(u.createdAt)}</Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-0.5">{rowActions(u)}</div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>

            <CardList label="Users">
              {paginatedUsers.map((u) => (
                <CardItem key={u.id} className="flex flex-col gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <PersonIcon className="h-7 w-7" />
                    <div className="min-w-0 flex-1" title={u.email}>
                      {/* Line box = icon height, so the name centres on the icon */}
                      <p className="truncate text-[15px] leading-7 text-foreground">
                        {u.firstName} {u.lastName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ActiveStatus active={!!u.isActive} />
                        <RoleChip role={u.role} />
                        <SecurityMarkers user={u} />
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-end justify-between gap-3">
                    <ScopeCell user={u} />
                    <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                      Added {formatDate(u.createdAt)}
                    </span>
                  </div>
                  <div className="-mb-1 flex items-center justify-end gap-0.5 border-t border-border/30 pt-2">
                    {rowActions(u)}
                  </div>
                </CardItem>
              ))}
            </CardList>
          </>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="px-4 pb-4 pt-3 min-[400px]:px-5 sm:px-6">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filteredUsers.length}
              onChange={setCurrentPage}
              label="Users pages"
              noun={["user", "users"]}
            />
          </div>
        )}
      </SettingsPanel>

      {/* Profile preview */}
      <Modal isOpen={!!previewUser} onClose={() => setPreviewUser(null)} maxWidth="sm:max-w-sm" title="User details">
        {previewUser && (
          <div className="flex flex-col">
            <div className="flex flex-col items-center pb-5 text-center">
              <Initials first={previewUser.firstName} last={previewUser.lastName} size="lg" />
              <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">{fullName(previewUser)}</p>
              <p className="mt-0.5 break-all text-xs text-muted-foreground">{previewUser.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                <RoleChip role={previewUser.role} />
                <SecurityMarkers user={previewUser} />
              </div>
            </div>

            <div className="space-y-2">
              <FactRow label="Status" icon={CircleDot}>
                <ActiveStatus active={!!previewUser.isActive} />
              </FactRow>
              <FactRow label="Added" icon={CalendarPlus}>
                {formatDate(previewUser.createdAt)}
              </FactRow>
              <FactRow label="Last sign-in" icon={LogIn}>
                {previewUser.lastLoginAt ? formatDateTime(previewUser.lastLoginAt) : "Never"}
              </FactRow>
              {previewScope && (
                <FactRow label="Scope" icon={MapPin}>
                  {previewScope}
                </FactRow>
              )}
            </div>

            <Button variant="outline" className={`${PILL_BUTTON.secondary} mt-5 w-full`} onClick={() => setPreviewUser(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchInitialData()}
        editingUser={editingUser}
        roles={roles}
        schools={allSchools}
      />

      <BulkUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchInitialData}
      />

      <DeleteConfirmationModal
        isOpen={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={() => pendingDeactivate && handleDeleteUser(pendingDeactivate.id, pendingDeactivate.name)}
        title="Deactivate user"
        description={`Deactivate ${pendingDeactivate?.name ?? "this user"}? They will be signed out and can no longer sign in.`}
        confirmLabel="Deactivate"
        isLoading={pendingDeactivate ? isAL(`del-user-${pendingDeactivate.id}`) : false}
      />
    </div>
  );
}
