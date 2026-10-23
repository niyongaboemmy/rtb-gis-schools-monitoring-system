import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Globe2, Layers, Pencil, Plus, Shield, Sparkles, Trash2 } from "lucide-react";
import { FloatingStat } from "../dashboard/FloatingStat";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast, notify } from "../ui/toast";
import { DeleteConfirmationModal } from "../ui/delete-confirmation-modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { StatusPill } from "../ui/status-pill";
import { EASE_OUT, INSET, PILL_BUTTON, TONE_TILE } from "../ui/surfaces";
import { formatNumber } from "../../lib/format";
import { titleCase } from "../../lib/labels";
import { cn } from "../../lib/utils";
import {
  EmptyNote,
  FieldLabel,
  IconAction,
  ListSkeleton,
  SettingsPanel,
  HeroStats,
} from "./settings-ui";

// ── Local helpers ───────────────────────────────────────────────────────────

interface AccessLevel {
  id: string;
  name: string;
  slug?: string | null;
  rank?: number;
}

interface RoleSummary {
  id: string;
  name?: string;
  accessLevel?: { id: string } | null;
}

/** What each built-in tier can see (keyed by the stable `slug`). */
const REACH_BY_SLUG: Record<string, string> = {
  national: "Sees every school in the country.",
  province: "Sees schools in the user's province.",
  district: "Sees schools in the user's district.",
  sector: "Sees schools in the user's sector.",
  school: "Sees only the user's own school.",
};

const CUSTOM_REACH = "Custom level with no geographic limit yet, so its roles see every school.";

function reachOf(level: AccessLevel): string {
  return (level?.slug && REACH_BY_SLUG[level.slug]) || CUSTOM_REACH;
}

function isBuiltIn(level: AccessLevel): boolean {
  return Boolean(level?.slug && REACH_BY_SLUG[level.slug]);
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** Highest rank first in the hierarchy (lower number = broader reach). */
function byRank(a: AccessLevel, b: AccessLevel) {
  const ra = typeof a?.rank === "number" ? a.rank : 100;
  const rb = typeof b?.rank === "number" ? b.rank : 100;
  return ra - rb || String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
}

const FORM_ID = "accessLevelForm";

// ── Component ───────────────────────────────────────────────────────────────

export function AccessLevelsTab() {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [accessLevels, setAccessLevels] = useState<AccessLevel[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Form State
  const [isAccessLevelModalOpen, setIsAccessLevelModalOpen] = useState(false);
  const [editingAccessLevel, setEditingAccessLevel] = useState<AccessLevel | null>(
    null,
  );
  const [accessLevelFormData, setAccessLevelFormData] = useState({ name: "" });

  // Loaders & Errors
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );

  const setAL = (key: string, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [key]: val }));
  const isAL = (key: string) => actionLoading[key] === true;

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchPromise = useRef<Promise<void> | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    if (fetchPromise.current) {
      return fetchPromise.current;
    }

    setLoading(true);

    fetchPromise.current = Promise.all([
      api.get("/access-levels"),
      api.get("/roles"),
    ]).then(([levelsRes, rolesRes]) => {
      setAccessLevels(levelsRes.data);
      setRoles(rolesRes.data);
    }).catch(err => {
      console.error("Failed to load access levels data", err);
      notify.error(apiErrorMessage(err, "Could not load access levels."));
    }).finally(() => {
      setLoading(false);
      fetchPromise.current = null;
    });

    return fetchPromise.current;
  };

  const rolesByLevel = useMemo(() => {
    const map: Record<string, RoleSummary[]> = {};
    for (const r of roles) {
      const id = r?.accessLevel?.id;
      if (!id) continue;
      (map[id] ??= []).push(r);
    }
    return map;
  }, [roles]);

  const ordered = useMemo(() => [...accessLevels].sort(byRank), [accessLevels]);

  const openCreate = () => {
    setEditingAccessLevel(null);
    setAccessLevelFormData({ name: "" });
    setError("");
    setIsAccessLevelModalOpen(true);
  };

  const openEdit = (al: AccessLevel) => {
    setEditingAccessLevel(al);
    setAccessLevelFormData({ name: al.name });
    setError("");
    setIsAccessLevelModalOpen(true);
  };

  const closeModal = () => {
    setIsAccessLevelModalOpen(false);
    setEditingAccessLevel(null);
    setAccessLevelFormData({ name: "" });
    setError("");
  };

  const handleSaveAccessLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = accessLevelFormData.name.trim();
    if (!name) {
      setError("Enter a name for the access level.");
      return;
    }
    setSubmitLoading(true);
    setError("");
    try {
      if (editingAccessLevel) {
        await api.patch(`/access-levels/${editingAccessLevel.id}`, { name });
      } else {
        await api.post("/access-levels", { name });
      }
      toast.success(
        `Access level "${name}" ${editingAccessLevel ? "updated" : "created"}`,
      );
      setIsAccessLevelModalOpen(false);
      setEditingAccessLevel(null);
      setAccessLevelFormData({ name: "" });
      fetchInitialData();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          `Could not ${editingAccessLevel ? "update" : "create"} the access level.`,
        ),
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteAccessLevel = async (id: string, name: string) => {
    const key = `del-al-${id}`;
    setAL(key, true);
    try {
      await api.delete(`/access-levels/${id}`);
      toast.success(`Access level "${name}" deleted`);
      setPendingDelete(null);
      fetchInitialData();
    } catch (err) {
      console.error("Failed to delete access level", err);
      toast.error(apiErrorMessage(err, `Could not delete access level "${name}".`));
    } finally {
      setAL(key, false);
    }
  };

  const pendingRoles = pendingDelete ? rolesByLevel[pendingDelete.id] ?? [] : [];
  const deleteDescription = pendingDelete
    ? pendingRoles.length > 0
      ? `"${pendingDelete.name}" is used by ${plural(pendingRoles.length, "role")}. Move those roles to another level first, or the delete may fail.`
      : `Delete "${pendingDelete.name}"? This can't be undone.`
    : "";

  // Hero summary (rendered inside the Settings hero).
  const builtInLevels = accessLevels.filter(isBuiltIn).length;
  const customLevels = accessLevels.length - builtInLevels;
  const scopedRoles = roles.filter((r) => r?.accessLevel?.id).length;
  const stat = (v: number) => (loading ? null : v);

  return (
    <>
      <HeroStats>
        <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 @4xl:grid-cols-4">
          <FloatingStat flat compact index={0} label="Access levels" caption="in the hierarchy" value={stat(accessLevels.length)} format={(n) => formatNumber(n)} icon={Layers} tone="text-primary" color="#3b82f6" />
          <FloatingStat flat compact index={1} label="Built-in" caption="with a geographic limit" value={stat(builtInLevels)} format={(n) => formatNumber(n)} icon={Globe2} tone="text-success" color="#10b981" />
          <FloatingStat flat
            compact
            index={2}
            label="Custom"
            caption={customLevels ? "see every school" : "none created"}
            value={stat(customLevels)}
            format={(n) => formatNumber(n)}
            icon={Sparkles}
            tone={customLevels ? "text-warning" : "text-muted-foreground"}
            color={customLevels ? "#f59e0b" : "#94a3b8"}
          />
          <FloatingStat flat
            compact
            index={3}
            label="Roles with a level"
            caption={`of ${formatNumber(roles.length)} roles`}
            value={stat(scopedRoles)}
            percent={loading || !roles.length ? null : (scopedRoles / roles.length) * 100}
            format={(n) => formatNumber(n)}
            icon={Shield}
            tone="text-violet-500 dark:text-violet-400"
            color="#8b5cf6"
          />
        </dl>
      </HeroStats>
      <SettingsPanel
        title="Access levels"
        subtitle="Geographic reach given to roles, broadest first."
        icon={Layers}
        flush
        actions={
          <Button className={PILL_BUTTON.primary} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Add access level
          </Button>
        }
      >
        {loading ? (
          <ListSkeleton rows={5} label="Loading access levels…" />
        ) : ordered.length === 0 ? (
          <EmptyNote
            icon={Layers}
            title="No access levels yet"
            hint="Add a level, then assign it to roles to limit what their users can see."
          />
        ) : (
          <ol
            aria-label="Access levels, broadest reach first"
            className="px-4 pb-5 min-[400px]:px-5 sm:px-6 sm:pb-6"
          >
            {ordered.map((al, i) => {
              const levelRoles = rolesByLevel[al.id] ?? [];
              const builtIn = isBuiltIn(al);
              const last = i === ordered.length - 1;
              const deleting = isAL(`del-al-${al.id}`);
              return (
                <motion.li
                  key={al.id}
                  initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                  transition={{ duration: 0.5, delay: 0.12 + i * 0.05, ease: EASE_OUT }}
                  className="relative flex gap-3 @md:gap-4"
                >
                  {/* Step marker + connector */}
                  <div className="flex shrink-0 flex-col items-center" aria-hidden>
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ring-1 ring-inset",
                        TONE_TILE[builtIn ? "primary" : "neutral"],
                      )}
                    >
                      {i + 1}
                    </span>
                    {!last && <span className="my-1 w-px flex-1 bg-border/60" />}
                  </div>

                  {/* Level card */}
                  <div className={cn("mb-3 min-w-0 flex-1 rounded-2xl p-3.5", INSET, last && "mb-0")}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">
                            {al.name}
                          </h3>
                          {builtIn ? (
                            <StatusPill tone="primary" dot={false}>Built-in</StatusPill>
                          ) : (
                            <StatusPill tone="warn">Sees all schools</StatusPill>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{reachOf(al)}</p>
                      </div>
                      <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                        <IconAction
                          label={`Edit access level ${al.name}`}
                          icon={Pencil}
                          onClick={() => openEdit(al)}
                        />
                        <IconAction
                          label={`Delete access level ${al.name}`}
                          icon={Trash2}
                          tone="danger"
                          loading={deleting}
                          onClick={() => setPendingDelete({ id: al.id, name: al.name })}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-normal text-foreground/80">
                        {levelRoles.length === 0 ? "No roles yet" : plural(levelRoles.length, "role")}
                      </span>
                      {levelRoles.map((r) => (
                        <span
                          key={r.id}
                          className="max-w-full truncate rounded-full bg-slate-900/4 px-2 py-0.5 ring-1 ring-inset ring-border/40 dark:bg-white/4"
                        >
                          {titleCase(String(r.name ?? ""))}
                        </span>
                      ))}
                      {typeof al.rank === "number" && (
                        <span className="ml-auto pl-2 text-muted-foreground/70">
                          Rank {formatNumber(al.rank)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </SettingsPanel>

      {/* Access Level Create / Edit Modal */}
      <Modal
        isOpen={isAccessLevelModalOpen}
        onClose={closeModal}
        maxWidth="sm:max-w-md"
        title={editingAccessLevel ? "Edit access level" : "Add access level"}
        description={
          editingAccessLevel
            ? "Renaming doesn't change what this level can see."
            : "New levels have no geographic limit until they're configured."
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={closeModal}
              className={PILL_BUTTON.secondary}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              className={PILL_BUTTON.primary}
              isLoading={submitLoading}
              disabled={submitLoading}
            >
              {submitLoading
                ? "Saving…"
                : editingAccessLevel
                  ? "Save changes"
                  : "Add level"}
            </Button>
          </>
        }
      >
        <div className="@container">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-xs font-normal text-destructive ring-1 ring-inset ring-destructive/20"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 wrap-break-word">{error}</span>
            </div>
          )}
          <form
            id={FORM_ID}
            onSubmit={handleSaveAccessLevel}
            className="grid grid-cols-1 gap-4 pb-2"
          >
            <div className="space-y-2">
              <FieldLabel htmlFor="access-level-name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="access-level-name"
                required
                autoFocus
                maxLength={100}
                value={accessLevelFormData.name}
                onChange={(e) => setAccessLevelFormData({ name: e.target.value })}
                placeholder="e.g. District"
              />
            </div>
          </form>
        </div>
      </Modal>

      <DeleteConfirmationModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() =>
          pendingDelete &&
          handleDeleteAccessLevel(pendingDelete.id, pendingDelete.name)
        }
        title="Delete access level"
        description={deleteDescription}
        confirmLabel="Delete level"
        isLoading={pendingDelete ? isAL(`del-al-${pendingDelete.id}`) : false}
      />
    </>
  );
}
