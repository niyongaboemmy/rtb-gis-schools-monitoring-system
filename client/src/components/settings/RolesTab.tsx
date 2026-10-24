import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast, notify } from "../ui/toast";
import { DeleteConfirmationModal } from "../ui/delete-confirmation-modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/modal";
import { RichDropdown } from "../ui/rich-dropdown";
import { SearchInput } from "../ui/search-input";
import { StatusPill } from "../ui/status-pill";
import { EASE_OUT, GLASS, INSET, PILL_BUTTON } from "../ui/surfaces";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { IconTile, IconAction, FieldLabel, ListSkeleton, EmptyNote, HeroStats } from "./settings-ui";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldPlus,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/utils";
import { PERMISSION_GROUPS } from "../../lib/permissions";
import { titleCase } from "../../lib/labels";
import { formatNumber } from "../../lib/format";
import { FloatingStat } from "../dashboard/FloatingStat";

/** Roles the seed keeps in sync (cannot be deleted). */
const BUILT_IN_ROLES = ["super_admin", "admin", "gis_analyst", "viewer"];
/** Scoped presets the seed creates once (WS7.3); admins own them afterwards. */
const PRESET_ROLES = ["district_officer", "school_leader"];

/** Every permission the catalogue knows about. */
const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((it) => it.key));
const TOTAL_PERMISSIONS = ALL_PERMISSION_KEYS.length;

interface AccessLevelRow {
  id: string;
  name: string;
  rank?: number;
}

interface RoleRow {
  id: string;
  name: string;
  description?: string | null;
  permissions?: string[];
  accessLevel?: AccessLevelRow | null;
}

type Filter = "all" | "on" | "off";
type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY_FORM = { name: "", description: "", accessLevelId: "" };

/** Built-in / preset / custom, for the label next to a role. */
function roleKind(name: string): { label: string; tone: "primary" | "neutral" } | null {
  if (BUILT_IN_ROLES.includes(name)) return { label: "Built-in", tone: "primary" };
  if (PRESET_ROLES.includes(name)) return { label: "Preset", tone: "neutral" };
  return null;
}

/** Granted permissions the catalogue knows about (ignores stale keys). */
function grantedCount(role: { permissions?: string[] }) {
  const set = new Set(role.permissions ?? []);
  return ALL_PERMISSION_KEYS.filter((k) => set.has(k)).length;
}

// ── Small pieces ────────────────────────────────────────────────────────────

/** Thin coverage bar. */
function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const reduce = useReducedMotion();
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span aria-hidden className={cn("block h-1 overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.08]", className)}>
      <motion.span
        className="block h-full rounded-full bg-primary"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduce ? 0 : 0.45, ease: EASE_OUT }}
      />
    </span>
  );
}

/** Compact switch (decorative: the whole row is the `role="switch"`). */
function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
        on ? "bg-primary" : "bg-slate-900/[0.12] dark:bg-white/[0.14]",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none",
          on ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </span>
  );
}

/** Three-state group checkbox: all / some / none granted. */
function GroupCheck({
  state,
  label,
  onClick,
}: {
  state: "all" | "some" | "none";
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="checkbox"
          aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
          aria-label={label}
          onClick={onClick}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-md transition-colors",
              state === "none" ? "ring-1 ring-inset ring-slate-900/25 dark:ring-white/30" : "bg-primary text-primary-foreground",
            )}
          >
            {state === "all" && <Check className="h-3 w-3" strokeWidth={3} />}
            {state === "some" && <Minus className="h-3 w-3" strokeWidth={3} />}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Wraps search matches in a soft highlight. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-[15px] text-muted-foreground">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.15 }}
          className={cn("flex items-center gap-1.5", state === "error" && "text-destructive", state === "saved" && "text-success")}
        >
          {state === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
            </>
          ) : state === "error" ? (
            <>
              <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Not saved
            </>
          ) : state === "saved" ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Saved
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden /> Changes save automatically
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ── Tab ─────────────────────────────────────────────────────────────────────

export function RolesTab() {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [accessLevels, setAccessLevels] = useState<AccessLevelRow[]>([]);
  const [loading, setLoading] = useState(true);

  // The selection is an id; the role itself always comes from `roles`, so a
  // refresh can never leave the detail panel showing a stale copy.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRole = roles.find((r) => r.id === selectedId) ?? null;
  const [roleQuery, setRoleQuery] = useState("");

  // Permission browsing
  const [permQuery, setPermQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([PERMISSION_GROUPS[0]?.group]));

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [roleFormData, setRoleFormData] = useState(EMPTY_FORM);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [levelBusy, setLevelBusy] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<{ id: string; name: string } | null>(null);

  const fetchPromise = useRef<Promise<void> | null>(null);

  // ── Permission saves ────────────────────────────────────────────────────
  // The API takes the whole list, so saves run one after another per role and
  // always send the newest list: quick toggles can no longer overtake each
  // other and lose a change.
  const permsRef = useRef<Record<string, string[]>>({});
  const chainRef = useRef<Record<string, Promise<void>>>({});
  const pendingRef = useRef<Record<string, number>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const savedTimer = useRef<Record<string, number>>({});

  const fetchInitialData = useCallback(async () => {
    if (fetchPromise.current) return fetchPromise.current;
    setLoading(true);
    fetchPromise.current = Promise.all([api.get("/roles"), api.get("/access-levels")])
      .then(([rolesRes, levelsRes]) => {
        const rolesData: RoleRow[] = rolesRes.data;
        permsRef.current = Object.fromEntries(rolesData.map((r) => [r.id, r.permissions ?? []]));
        setRoles(rolesData);
        setAccessLevels(levelsRes.data);
        // Keep the current selection if it still exists, else the first role.
        setSelectedId((prev) => (prev && rolesData.some((r) => r.id === prev) ? prev : (rolesData[0]?.id ?? null)));
      })
      .catch((err) => {
        console.error("Failed to load roles data", err);
        notify.error(apiErrorMessage(err, "Could not load roles."));
      })
      .finally(() => {
        setLoading(false);
        fetchPromise.current = null;
      });
    return fetchPromise.current;
  }, []);

  useEffect(() => {
    void fetchInitialData();
    const timers = savedTimer.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, [fetchInitialData]);

  const replaceRole = (updated: RoleRow) => {
    if (updated.permissions) permsRef.current[updated.id] = updated.permissions;
    setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const updatePermissions = (role: RoleRow, mutate: (current: string[]) => string[]) => {
    const id = role.id;
    const next = mutate(permsRef.current[id] ?? role.permissions ?? []);
    permsRef.current[id] = next;
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, permissions: next } : r)));

    pendingRef.current[id] = (pendingRef.current[id] ?? 0) + 1;
    window.clearTimeout(savedTimer.current[id]);
    setSaveState((s) => ({ ...s, [id]: "saving" }));

    const run = async () => {
      try {
        await api.patch(`/roles/${id}`, { permissions: permsRef.current[id] });
        pendingRef.current[id] -= 1;
        if (pendingRef.current[id] === 0) {
          setSaveState((s) => ({ ...s, [id]: "saved" }));
          savedTimer.current[id] = window.setTimeout(() => setSaveState((s) => ({ ...s, [id]: "idle" })), 2000);
        }
      } catch (err) {
        pendingRef.current[id] -= 1;
        setSaveState((s) => ({ ...s, [id]: "error" }));
        toast.error(apiErrorMessage(err, `Could not update permissions for ${titleCase(role.name)}.`));
        void fetchInitialData(); // show what the server really has
      }
    };
    chainRef.current[id] = (chainRef.current[id] ?? Promise.resolve()).then(run);
  };

  const togglePermission = (role: RoleRow, key: string, grant: boolean) =>
    updatePermissions(role, (cur) => (grant ? Array.from(new Set([...cur, key])) : cur.filter((p) => p !== key)));

  const toggleGroup = (role: RoleRow, keys: string[], grant: boolean) =>
    updatePermissions(role, (cur) => (grant ? Array.from(new Set([...cur, ...keys])) : cur.filter((p) => !keys.includes(p))));

  // ── Role CRUD ───────────────────────────────────────────────────────────

  const handleRoleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRoleFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    setError("");
    setRoleFormData(EMPTY_FORM);
    setModalMode("create");
  };

  const openEdit = (role: RoleRow) => {
    setError("");
    setRoleFormData({ name: role.name ?? "", description: role.description ?? "", accessLevelId: role.accessLevel?.id ?? "" });
    setModalMode("edit");
  };

  const handleCreateRole = async () => {
    const res = await api.post("/roles", { ...roleFormData, name: roleFormData.name.trim(), permissions: [] });
    toast.success(`Role "${titleCase(roleFormData.name)}" created`);
    setModalMode(null);
    setRoleFormData(EMPTY_FORM);
    await fetchInitialData();
    if (res.data?.id) setSelectedId(res.data.id);
  };

  /** Edits the description (and, for custom roles only, the name). */
  const handleEditRole = async () => {
    if (!selectedRole) return;
    const payload: { description: string; name?: string } = { description: roleFormData.description };
    if (!roleKind(selectedRole.name) && roleFormData.name.trim() && roleFormData.name !== selectedRole.name) {
      payload.name = roleFormData.name.trim();
    }
    const res = await api.patch(`/roles/${selectedRole.id}`, payload);
    replaceRole(res.data);
    toast.success(`Role "${titleCase(res.data?.name ?? selectedRole.name)}" updated`);
    setModalMode(null);
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) {
      setError("Give the role a name.");
      return;
    }
    setSubmitLoading(true);
    setError("");
    try {
      if (modalMode === "edit") await handleEditRole();
      else await handleCreateRole();
    } catch (err) {
      setError(apiErrorMessage(err, modalMode === "edit" ? "Could not update the role." : "Could not create the role."));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAccessLevelChange = async (role: RoleRow, accessLevelId: string) => {
    setLevelBusy(role.id);
    try {
      const res = await api.patch(`/roles/${role.id}`, { accessLevelId });
      replaceRole(res.data);
      const levelName = accessLevels.find((al) => al.id === accessLevelId)?.name;
      toast.success(`${titleCase(res.data?.name ?? role.name)} now works at ${levelName ? titleCase(levelName) : "the selected"} level`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not change the role's access level."));
    } finally {
      setLevelBusy(null);
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    setDeleteBusy(true);
    try {
      await api.delete(`/roles/${id}`);
      toast.success(`Role "${titleCase(name)}" deleted`);
      setPendingDeleteRole(null);
      setSelectedId(roles.find((r) => r.id !== id)?.id ?? null);
      void fetchInitialData();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete the role."));
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────

  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) => titleCase(r.name).toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q),
    );
  }, [roles, roleQuery]);
  const systemRoles = filteredRoles.filter((r) => roleKind(r.name));
  const customRoles = filteredRoles.filter((r) => !roleKind(r.name));
  const orderedRoles = [...systemRoles, ...customRoles];

  // Broadest first (National ▸ … ▸ School), like the Access levels tab.
  const levelOptions = [...accessLevels]
    .sort((a, b) => (a.rank ?? 100) - (b.rank ?? 100) || a.name.localeCompare(b.name))
    .map((al) => ({ label: titleCase(al.name), value: al.id, icon: <Layers className="h-3.5 w-3.5" aria-hidden /> }));

  const levelName = (role: RoleRow) => (role.accessLevel?.name ? titleCase(role.accessLevel.name) : "No level");

  // Hero summary (rendered inside the Settings hero).
  const customCount = roles.filter((r) => !roleKind(r.name)).length;
  const avgGranted = roles.length ? roles.reduce((n, r) => n + grantedCount(r), 0) / roles.length : 0;
  const stat = (v: number) => (loading ? null : v);
  const heroStats = (
    <HeroStats>
      <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 @4xl:grid-cols-4">
        <FloatingStat flat compact index={0} label="Roles" caption="defined in total" value={stat(roles.length)} format={(n) => formatNumber(n)} icon={Shield} tone="text-primary" color="#3b82f6" />
        <FloatingStat
          flat
          compact
          index={1}
          label="Custom roles"
          caption="created by admins"
          value={stat(customCount)}
          percent={loading || !roles.length ? null : (customCount / roles.length) * 100}
          format={(n) => formatNumber(n)}
          icon={ShieldPlus}
          tone="text-violet-500 dark:text-violet-400"
          color="#8b5cf6"
        />
        <FloatingStat
          flat
          compact
          index={2}
          label="Avg. permissions"
          caption={`of ${formatNumber(TOTAL_PERMISSIONS)} per role`}
          value={stat(Math.round(avgGranted))}
          percent={loading || !TOTAL_PERMISSIONS ? null : (avgGranted / TOTAL_PERMISSIONS) * 100}
          format={(n) => formatNumber(n)}
          icon={KeyRound}
          tone="text-success"
          color="#10b981"
        />
        <FloatingStat flat compact index={3} label="Access levels" caption="roles can be scoped to" value={stat(accessLevels.length)} format={(n) => formatNumber(n)} icon={Layers} tone="text-warning" color="#f59e0b" />
      </dl>
    </HeroStats>
  );

  if (loading && roles.length === 0) {
    return (
      <div className="@container">
        {heroStats}
        <div className={cn("overflow-hidden rounded-[1.75rem] py-5", GLASS)}>
          <ListSkeleton rows={6} label="Loading roles…" />
        </div>
      </div>
    );
  }

  // ── Role list (wide) ────────────────────────────────────────────────────

  const onRoleKey = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = e.key === "ArrowDown" ? index + 1 : e.key === "ArrowUp" ? index - 1 : -1;
    if (next < 0 || next >= orderedRoles.length) return;
    e.preventDefault();
    setSelectedId(orderedRoles[next].id);
    document.getElementById(`role-option-${orderedRoles[next].id}`)?.focus();
  };

  const roleItem = (role: RoleRow) => {
    const selected = role.id === selectedId;
    const granted = grantedCount(role);
    const index = orderedRoles.indexOf(role);
    return (
      <li key={role.id}>
        <button
          id={`role-option-${role.id}`}
          type="button"
          onClick={() => setSelectedId(role.id)}
          onKeyDown={(e) => onRoleKey(e, index)}
          aria-current={selected ? "true" : undefined}
          className={cn(
            "w-full rounded-xl px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            selected ? "bg-primary/10" : "hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.04]",
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-[15px]", selected ? "text-primary" : "text-foreground")}>
              <Highlight text={titleCase(role.name)} query={roleQuery} />
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
              {granted}/{TOTAL_PERMISSIONS}
            </span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-[13px] text-muted-foreground">{levelName(role)}</span>
            <Meter value={granted} max={TOTAL_PERMISSIONS} className="flex-1" />
          </span>
        </button>
      </li>
    );
  };

  const roleSection = (title: string, list: RoleRow[]) =>
    list.length > 0 && (
      <div>
        <p className="px-3 pb-1 pt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">{title}</p>
        <ul className="space-y-0.5">{list.map(roleItem)}</ul>
      </div>
    );

  const roleList = (
    <aside
      aria-label="Roles"
      className={cn("hidden min-w-0 flex-col overflow-hidden rounded-[1.75rem] @4xl:sticky @4xl:top-4 @4xl:flex @4xl:max-h-[calc(100dvh-6rem)]", GLASS)}
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <p className="text-sm text-foreground">
          Roles <span className="text-muted-foreground">{formatNumber(roles.length)}</span>
        </p>
        <IconAction label="New role" icon={Plus} onClick={openCreate} />
      </div>
      <div className="px-3 pb-1">
        <SearchInput
          value={roleQuery}
          onChange={(e) => setRoleQuery(e.target.value)}
          onClear={() => setRoleQuery("")}
          placeholder="Search roles"
          aria-label="Search roles"
          containerClassName="[&>div]:h-9 [&>div]:rounded-xl"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {orderedRoles.length ? (
          <>
            {roleSection("System", systemRoles)}
            {roleSection("Custom", customRoles)}
          </>
        ) : (
          <EmptyNote icon={Search} title="No matching roles" hint="Try another name." />
        )}
      </div>
    </aside>
  );

  // ── Narrow: compact picker ──────────────────────────────────────────────

  const rolePicker = (
    <div className="flex items-center gap-2 @4xl:hidden">
      <RichDropdown
        className="min-w-0 flex-1 [&>button]:rounded-xl"
        options={orderedRoles.map((r) => ({
          label: `${titleCase(r.name)} · ${grantedCount(r)}/${TOTAL_PERMISSIONS}`,
          value: r.id,
        }))}
        value={selectedId ?? undefined}
        onChange={(val) => setSelectedId(val)}
        placeholder="Choose a role…"
        searchPlaceholder="Search roles"
      />
      <Button type="button" onClick={openCreate} className={cn(PILL_BUTTON.secondary, "shrink-0")} aria-label="New role">
        <Plus className="h-4 w-4" aria-hidden />
        <span className="hidden min-[420px]:inline">New role</span>
      </Button>
    </div>
  );

  // ── Detail ──────────────────────────────────────────────────────────────

  const q = permQuery.trim().toLowerCase();
  const permissionView = (role: RoleRow) => {
    const set = new Set(role.permissions ?? []);
    return PERMISSION_GROUPS.map(({ group, items }) => {
      const visible = items.filter((it) => {
        if (filter === "on" && !set.has(it.key)) return false;
        if (filter === "off" && set.has(it.key)) return false;
        if (!q) return true;
        return it.label.toLowerCase().includes(q) || (it.description ?? "").toLowerCase().includes(q);
      });
      const granted = items.filter((it) => set.has(it.key)).length;
      return { group, items, visible, granted, set };
    }).filter((g) => g.visible.length > 0);
  };

  const narrowing = q !== "" || filter !== "all";
  const isOpen = (group: string) => narrowing || openGroups.has(group);
  const toggleOpen = (group: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  const allOpen = PERMISSION_GROUPS.every((g) => openGroups.has(g.group));

  const detail = selectedRole
    ? (() => {
        const role = selectedRole;
        const kind = roleKind(role.name);
        const granted = grantedCount(role);
        const groups = permissionView(role);
        const isBuiltIn = BUILT_IN_ROLES.includes(role.name);
        return (
          <section aria-label={`${titleCase(role.name)} permissions`} className={cn("@container min-w-0 rounded-[1.75rem]", GLASS)}>
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 min-[400px]:px-5 min-[400px]:pt-5 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">{titleCase(role.name)}</h2>
                  {kind && (
                    <StatusPill tone={kind.tone} dot={false}>
                      {kind.label}
                    </StatusPill>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground/70">{role.description || "No description yet"}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <IconAction label="Edit name and description" icon={Pencil} onClick={() => openEdit(role)} />
                <IconAction
                  label={isBuiltIn ? "Built-in roles can't be deleted" : "Delete role"}
                  icon={isBuiltIn ? Lock : Trash2}
                  tone="danger"
                  onClick={() => setPendingDeleteRole(role)}
                  disabled={isBuiltIn}
                  loading={deleteBusy && pendingDeleteRole?.id === role.id}
                />
              </div>
            </header>

            {/* Summary: level · coverage · save state, on one aligned row */}
            <div className="mx-4 mt-4 grid divide-y divide-border/40 rounded-2xl bg-background/70 ring-1 ring-inset ring-border/40 min-[400px]:mx-5 sm:mx-6 @xl:grid-cols-3 @xl:divide-x @xl:divide-y-0 dark:bg-background/40">
              <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                <label htmlFor="role-level" className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Access level
                </label>
                <RichDropdown
                  id="role-level"
                  aria-label="Role access level"
                  variant="ghost"
                  options={levelOptions}
                  value={role.accessLevel?.id || undefined}
                  onChange={(val) => {
                    if (val && val !== role.accessLevel?.id) void handleAccessLevelChange(role, val);
                  }}
                  disabled={levelBusy === role.id}
                  placeholder={levelBusy === role.id ? "Saving…" : "Select a level…"}
                  searchPlaceholder="Search levels"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Permissions</span>
                <span className="flex h-8 items-center gap-3">
                  <span className="shrink-0 text-[15px] tabular-nums text-foreground">
                    {formatNumber(granted)} <span className="text-muted-foreground">of {formatNumber(TOTAL_PERMISSIONS)}</span>
                  </span>
                  <Meter value={granted} max={TOTAL_PERMISSIONS} className="flex-1" />
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
                <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</span>
                <div className="flex h-8 items-center">
                  <SaveIndicator state={saveState[role.id] ?? "idle"} />
                </div>
              </div>
            </div>

            {/* Browse tools */}
            <div className="flex flex-col gap-2 px-4 pt-4 min-[400px]:px-5 sm:px-6 @2xl:flex-row @2xl:items-center">
              <SearchInput
                value={permQuery}
                onChange={(e) => setPermQuery(e.target.value)}
                onClear={() => setPermQuery("")}
                placeholder="Search permissions"
                aria-label="Search permissions"
                containerClassName="@2xl:max-w-xs [&>div]:h-9 [&>div]:rounded-xl"
              />
              <div className="flex items-center gap-2">
                <div role="radiogroup" aria-label="Show" className="flex rounded-full bg-slate-900/[0.04] p-0.5 dark:bg-white/[0.04]">
                  {(
                    [
                      ["all", "All"],
                      ["on", "Granted"],
                      ["off", "Not granted"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={filter === id}
                      onClick={() => setFilter(id)}
                      className={cn(
                        "relative h-8 rounded-full px-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        filter === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {filter === id && (
                        <motion.span
                          layoutId="perm-filter"
                          className="absolute inset-0 rounded-full bg-background shadow-sm dark:bg-white/10"
                          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <span className="relative whitespace-nowrap">{label}</span>
                    </button>
                  ))}
                </div>
                {!narrowing && (
                  <IconAction
                    label={allOpen ? "Collapse all groups" : "Expand all groups"}
                    icon={allOpen ? ChevronsDownUp : ChevronsUpDown}
                    onClick={() => setOpenGroups(allOpen ? new Set() : new Set(PERMISSION_GROUPS.map((g) => g.group)))}
                  />
                )}
              </div>
            </div>

            {/* Groups */}
            <div className="space-y-2 px-4 pb-5 pt-3 min-[400px]:px-5 sm:px-6 sm:pb-6">
              {groups.length === 0 ? (
                <EmptyNote
                  icon={Search}
                  title="No permissions match"
                  hint="Try another word or show all permissions."
                  action={
                    <Button
                      variant="outline"
                      className={PILL_BUTTON.small}
                      onClick={() => {
                        setPermQuery("");
                        setFilter("all");
                      }}
                    >
                      Show all
                    </Button>
                  }
                />
              ) : (
                groups.map(({ group, items, visible, granted: groupGranted, set }) => {
                  const open = isOpen(group);
                  const state = groupGranted === items.length ? "all" : groupGranted === 0 ? "none" : "some";
                  const panelId = `perm-group-${group.replace(/\W+/g, "-")}`;
                  return (
                    <div key={group} className={cn("overflow-hidden rounded-2xl", INSET)}>
                      <div className="flex items-center gap-2 py-1.5 pl-2 pr-3">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => toggleOpen(group)}
                          disabled={narrowing}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                        >
                          <ChevronRight
                            aria-hidden
                            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-90")}
                          />
                          <span className="truncate text-[15px] text-foreground">{group}</span>
                          <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                            {groupGranted}/{items.length}
                          </span>
                          <Meter value={groupGranted} max={items.length} className="ml-auto hidden w-20 @md:block" />
                        </button>
                        <GroupCheck
                          state={state}
                          label={state === "all" ? `Clear all ${group} permissions` : `Grant all ${group} permissions`}
                          onClick={() => toggleGroup(role, items.map((it) => it.key), state !== "all")}
                        />
                      </div>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.ul
                            id={panelId}
                            initial={reduce ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reduce ? undefined : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: EASE_OUT }}
                            className="divide-y divide-border/40 overflow-hidden border-t border-border/40"
                          >
                            {visible.map(({ key, label, description }) => {
                              const on = set.has(key);
                              return (
                                <li key={key}>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={on}
                                    onClick={() => togglePermission(role, key, !on)}
                                    className="flex w-full items-center gap-4 px-4 py-3 text-left outline-none transition-colors hover:bg-slate-900/[0.02] focus-visible:bg-primary/5 dark:hover:bg-white/[0.03]"
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[15px] text-foreground">
                                        <Highlight text={label} query={permQuery} />
                                      </span>
                                      {description && (
                                        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                                          <Highlight text={description} query={permQuery} />
                                        </span>
                                      )}
                                    </span>
                                    <Switch on={on} />
                                  </button>
                                </li>
                              );
                            })}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        );
      })()
    : (
      <div className={cn("rounded-[1.75rem]", GLASS)}>
        <EmptyNote
          icon={Shield}
          title={roles.length ? "No role selected" : "No roles yet"}
          hint={roles.length ? "Choose a role to see what it can do." : "Create a role to start granting permissions."}
          action={
            roles.length ? undefined : (
              <Button className={PILL_BUTTON.small} onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> New role
              </Button>
            )
          }
        />
      </div>
    );

  const editing = modalMode === "edit";
  const nameLocked = editing && !!selectedRole && !!roleKind(selectedRole.name);

  return (
    <div className="@container">
      {heroStats}
      <div className="grid gap-4 @4xl:grid-cols-[17rem_minmax(0,1fr)] @4xl:items-start @4xl:gap-5">
        {roleList}
        <div className="min-w-0 space-y-3">
          {rolePicker}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedId ?? "none"}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {detail}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-3">
            <IconTile icon={editing ? Pencil : Plus} />
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-semibold tracking-tight text-foreground">{editing ? "Edit role" : "New role"}</span>
              <span className="text-xs font-normal text-muted-foreground/70">
                {editing ? "Name and description" : "Grant permissions after it's created"}
              </span>
            </div>
          </div>
        }
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModalMode(null)} className={PILL_BUTTON.secondary}>
              Cancel
            </Button>
            <Button type="submit" form="roleForm" className={PILL_BUTTON.primary} isLoading={submitLoading}>
              {editing ? "Save changes" : "Create role"}
            </Button>
          </>
        }
      >
        <form id="roleForm" onSubmit={handleSubmitRole} className="space-y-5 pb-2">
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <FieldLabel htmlFor="role-name" hint={nameLocked ? "System roles keep their name" : undefined}>
              Name
            </FieldLabel>
            <Input
              id="role-name"
              name="name"
              required
              maxLength={100}
              value={roleFormData.name}
              onChange={handleRoleInputChange}
              readOnly={nameLocked}
              placeholder="e.g. coordinator"
              autoComplete="off"
            />
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <FieldLabel>
                Access level <span className="text-destructive">*</span>
              </FieldLabel>
              <RichDropdown
                options={levelOptions}
                value={roleFormData.accessLevelId}
                onChange={(val) => setRoleFormData((prev) => ({ ...prev, accessLevelId: val as string }))}
                placeholder="Select an access level…"
              />
              <input type="text" required value={roleFormData.accessLevelId} readOnly className="sr-only" aria-hidden tabIndex={-1} />
            </div>
          )}
          <div className="space-y-1.5">
            <FieldLabel htmlFor="role-description" hint="Optional">
              Description
            </FieldLabel>
            <Textarea
              id="role-description"
              name="description"
              value={roleFormData.description}
              onChange={handleRoleInputChange}
              placeholder="What people with this role do"
            />
          </div>
        </form>
      </Modal>

      <DeleteConfirmationModal
        isOpen={pendingDeleteRole !== null}
        onClose={() => setPendingDeleteRole(null)}
        onConfirm={() => pendingDeleteRole && handleDeleteRole(pendingDeleteRole.id, pendingDeleteRole.name)}
        title="Delete role"
        description={`Delete the role "${pendingDeleteRole ? titleCase(pendingDeleteRole.name) : ""}"? Users assigned to it may lose access.`}
        confirmLabel="Delete role"
        isLoading={deleteBusy}
      />
    </div>
  );
}
