import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, BookOpen, Building2, Check, ClipboardCopy, Globe2, KeyRound, Landmark, MapPinned, Pencil, Plus, ShieldAlert } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { formatDateTime, formatRelative } from "../../lib/format";
import { getDistricts, getProvinces } from "../../lib/rwanda-locations";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { StatusPill } from "../ui/status-pill";
import { fieldSurface } from "../ui/field-styles";
import { PILL_BUTTON } from "../ui/surfaces";
import { useToast } from "../ui/toast";
import {
  accessReady,
  accessSummary,
  fromKey,
  toPayload,
  VIEWS,
  viewsOf,
  type AccessTier,
  type AccessValue,
  type PartnerKey,
} from "./partner-access-model";

export type { PartnerKey } from "./partner-access-model";

const SCOPES: Array<{ id: string; label: string; hint: string }> = [
  { id: "coordinates:read", label: "Coordinates", hint: "Read school points (to update TDMP's GPS)" },
  { id: "schools:read", label: "Schools", hint: "Read the school list and boundaries" },
  { id: "embed:create", label: "Embed views", hint: "Request signed links to dashboards and maps" },
];

const TIERS: Array<{ id: AccessTier; label: string; icon: typeof Globe2; hint: string }> = [
  { id: "national", label: "National", icon: Globe2, hint: "Every school in RTB GIS" },
  { id: "province", label: "Province", icon: Landmark, hint: "Schools in one province" },
  { id: "district", label: "District", icon: MapPinned, hint: "Schools in one district" },
  { id: "schools", label: "Specific schools", icon: Building2, hint: "Only the schools you list" },
];

/** Chooses how far a key reaches and which views it may open. */
export function AccessEditor({ value, onChange }: { value: AccessValue; onChange: (v: AccessValue) => void }) {
  const set = (patch: Partial<AccessValue>) => onChange({ ...value, ...patch });
  const districts = value.accessProvince ? getDistricts(value.accessProvince) : [];
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-xs text-muted-foreground">Access level: which schools this key can reach</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Access level">
          {TIERS.map((t) => {
            const on = value.accessTier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ accessTier: t.id })}
                data-tooltip={t.hint}
                className={cn(
                  "relative flex flex-col items-start gap-1 rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors",
                  on ? "bg-primary/10 ring-primary/40" : "ring-slate-900/10 hover:ring-primary/25 dark:ring-white/10",
                )}
              >
                <t.icon className={cn("h-4 w-4", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className={cn("text-xs font-medium", on ? "text-primary" : "text-foreground")}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {(value.accessTier === "province" || value.accessTier === "district") && (
          <motion.div key="area" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Province
              <select
                value={value.accessProvince}
                onChange={(e) => set({ accessProvince: e.target.value, accessDistrict: "" })}
                className={cn(fieldSurface, "block h-9 w-full rounded-xl px-2 text-sm")}
              >
                <option value="">Choose a province</option>
                {getProvinces().map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {value.accessTier === "district" && (
              <label className="space-y-1 text-xs text-muted-foreground">
                District
                <select
                  value={value.accessDistrict}
                  onChange={(e) => set({ accessDistrict: e.target.value })}
                  disabled={!value.accessProvince}
                  className={cn(fieldSurface, "block h-9 w-full rounded-xl px-2 text-sm")}
                >
                  <option value="">{value.accessProvince ? "Choose a district" : "Choose a province first"}</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </motion.div>
        )}
        {value.accessTier === "schools" && (
          <motion.label key="schools" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="block space-y-1 text-xs text-muted-foreground">
            School codes (TDMP / SDMS), one per line or comma-separated
            <textarea
              value={value.accessSchoolCodes}
              onChange={(e) => set({ accessSchoolCodes: e.target.value })}
              rows={3}
              placeholder={"270501\n280705"}
              className="w-full rounded-xl border border-border bg-background p-2 font-mono text-xs text-foreground"
            />
          </motion.label>
        )}
      </AnimatePresence>

      <fieldset>
        <legend className="mb-1.5 text-xs text-muted-foreground">Embedded views this key may open</legend>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => {
            const on = value.allowedViews.includes(v.id);
            const disabled = v.id === "national-map" && value.accessTier === "schools";
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on && !disabled}
                disabled={disabled}
                onClick={() => set({ allowedViews: on ? value.allowedViews.filter((x) => x !== v.id) : [...value.allowedViews, v.id] })}
                data-tooltip={disabled ? "A key for specific schools cannot open the national map" : undefined}
                className={cn(
                  "rounded-full px-3 py-1 text-xs ring-1 ring-inset disabled:opacity-40",
                  on && !disabled ? "bg-primary/10 font-medium text-primary ring-primary/30" : "text-muted-foreground ring-slate-900/10 dark:ring-white/10",
                )}
              >
                {on && !disabled && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                {v.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

function NewKeyNotice({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-inset ring-amber-500/25" role="alert">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden /> Copy this key now: it will not be shown again
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100">{apiKey}</code>
        <Button
          variant="outline"
          className={PILL_BUTTON.small}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(apiKey);
              setCopied(true);
            } catch {
              /* clipboard blocked: the key stays selectable */
            }
          }}
          data-tooltip="Copy the key"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Send it to the partner over a secure channel (not email in plain text). It belongs on their server only.</p>
      <Button className={PILL_BUTTON.small} onClick={onDone}>
        I have stored it
      </Button>
    </motion.div>
  );
}

/** Partner keys: who may read RTB GIS data and embed its views, and how far each one reaches. */
export function PartnerAccess({ onChanged }: { onChanged?: (keys: PartnerKey[]) => void }) {
  const toast = useToast();
  const [keys, setKeys] = useState<PartnerKey[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: AccessValue } | null>(null);
  const [name, setName] = useState("TDMP production");
  const [partner, setPartner] = useState("TDMP");
  const [scopes, setScopes] = useState<string[]>(SCOPES.map((s) => s.id));
  const [origins, setOrigins] = useState("https://tdmp.rtb.gov.rw");
  const [access, setAccess] = useState<AccessValue>(fromKey());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<PartnerKey[]>("/partner-keys");
      setKeys(data);
      onChanged?.(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load partner keys."));
      setKeys([]);
    }
  }, [toast, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      const { data } = await api.post<PartnerKey & { apiKey: string }>("/partner-keys", {
        name,
        partner,
        scopes,
        allowedOrigins: origins.split(/[\s,]+/).filter(Boolean),
        ...toPayload(access),
      });
      setNewKey(data.apiKey);
      setCreating(false);
      setAccess(fromKey());
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create the key."));
    } finally {
      setSaving(false);
    }
  };

  const saveAccess = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/partner-keys/${editing.id}/access`, toPayload(editing.value));
      toast.success("Access updated. Views opened under the old access have ended.");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update the access level."));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await api.post(`/partner-keys/${id}/revoke`);
      toast.success("Key revoked. Views opened with it have ended.");
      setConfirmRevoke(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not revoke the key."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">
          Partner keys let another platform's server read school coordinates and embed RTB GIS views, read-only and only within the key's access level.
        </p>
        <div className="flex gap-2">
          <a
            href="/developers"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/5"
            data-tooltip="The guide to send to the partner's developers (new tab)"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> Developer guide
          </a>
          {!creating && (
            <Button className={PILL_BUTTON.small} onClick={() => setCreating(true)} data-tooltip="Create a key for a partner platform">
              <Plus className="h-3.5 w-3.5" aria-hidden /> New key
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>{newKey && <NewKeyNotice apiKey={newKey} onDone={() => setNewKey(null)} />}</AnimatePresence>

      <AnimatePresence>
        {creating && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden rounded-2xl bg-slate-900/[0.03] p-4 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                Key name
                <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="h-9 rounded-xl" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Partner
                <Input value={partner} onChange={(e) => setPartner(e.target.value)} required minLength={2} className="h-9 rounded-xl" />
              </label>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-xs text-muted-foreground">May</legend>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => {
                  const on = scopes.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setScopes((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                      data-tooltip={s.hint}
                      className={cn("rounded-full px-3 py-1 text-xs ring-1 ring-inset", on ? "bg-primary/10 font-medium text-primary ring-primary/30" : "text-muted-foreground ring-slate-900/10 dark:ring-white/10")}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <AccessEditor value={access} onChange={setAccess} />
            <label className="block space-y-1 text-xs text-muted-foreground">
              Sites that may show embedded views (one per line)
              <textarea value={origins} onChange={(e) => setOrigins(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background p-2 font-mono text-xs text-foreground" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className={PILL_BUTTON.small} onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" className={PILL_BUTTON.small} isLoading={saving} disabled={saving || !scopes.length || !accessReady(access)}>
                <KeyRound className="h-3.5 w-3.5" aria-hidden /> Create key
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {keys === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="rounded-2xl bg-slate-900/[0.03] px-4 py-6 text-center text-sm text-muted-foreground dark:bg-white/[0.035]">
          No partner keys yet. Create one for TDMP to start sharing coordinates and views.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Partner keys">
          {keys.map((k) => (
            <li key={k.id} className={cn("space-y-3 rounded-2xl p-3 ring-1 ring-inset", k.revokedAt ? "opacity-60 ring-slate-900/5 dark:ring-white/8" : "ring-slate-900/10 dark:ring-white/10")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {k.name}
                    <span className="font-mono text-[11px] text-muted-foreground">{k.keyPrefix}…</span>
                    {k.revokedAt ? <StatusPill tone="neutral">Revoked</StatusPill> : <StatusPill tone="good">Active</StatusPill>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary" data-tooltip="Which schools this key can reach">
                      <Globe2 className="h-3 w-3" aria-hidden /> {accessSummary(k)}
                    </span>
                    {viewsOf(k).map((v) => (
                      <span key={v} className="rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-muted-foreground dark:bg-white/10">
                        {VIEWS.find((x) => x.id === v)?.label ?? v}
                      </span>
                    ))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {k.partner} · {k.scopes.join(", ")} · created {formatRelative(k.createdAt)}
                    {k.createdBy ? ` by ${k.createdBy}` : ""} · {k.lastUsedAt ? `last used ${formatRelative(k.lastUsedAt)}` : "never used"}
                  </p>
                  {k.allowedOrigins.length > 0 && <p className="mt-0.5 truncate text-xs text-muted-foreground">Embeds on: {k.allowedOrigins.join(", ")}</p>}
                  {k.revokedAt && <p className="mt-0.5 text-xs text-muted-foreground">Revoked {formatDateTime(k.revokedAt)}</p>}
                </div>
                {!k.revokedAt &&
                  (confirmRevoke === k.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Ends all its views now.</span>
                      <Button variant="outline" className={PILL_BUTTON.small} onClick={() => setConfirmRevoke(null)}>
                        Keep
                      </Button>
                      <Button className={cn(PILL_BUTTON.small, "bg-destructive text-white hover:bg-destructive/90")} onClick={() => void revoke(k.id)}>
                        Revoke
                      </Button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {editing?.id !== k.id && (
                        <Button variant="outline" className={PILL_BUTTON.small} onClick={() => setEditing({ id: k.id, value: fromKey(k) })} data-tooltip="Change which schools and views this key reaches">
                          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit access
                        </Button>
                      )}
                      <Button variant="outline" className={PILL_BUTTON.small} onClick={() => setConfirmRevoke(k.id)} data-tooltip="Stop this key working; open embedded views end at once">
                        <Ban className="h-3.5 w-3.5" aria-hidden /> Revoke
                      </Button>
                    </span>
                  ))}
              </div>
              <AnimatePresence>
                {editing?.id === k.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden rounded-xl bg-slate-900/[0.03] p-3 dark:bg-white/[0.035]"
                  >
                    <AccessEditor value={editing.value} onChange={(value) => setEditing({ id: k.id, value })} />
                    <p className="text-xs text-muted-foreground">Saving ends every view opened under the current access; the partner's next request uses the new one.</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" className={PILL_BUTTON.small} onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                      <Button className={PILL_BUTTON.small} onClick={() => void saveAccess()} isLoading={saving} disabled={saving || !accessReady(editing.value)}>
                        Save access
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
