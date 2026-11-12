import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, BookOpen, Check, ClipboardCopy, KeyRound, Plus, ShieldAlert } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { formatDateTime, formatRelative } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { StatusPill } from "../ui/status-pill";
import { PILL_BUTTON } from "../ui/surfaces";
import { useToast } from "../ui/toast";

export interface PartnerKey {
  id: string;
  name: string;
  partner: string;
  keyPrefix: string;
  scopes: string[];
  allowedOrigins: string[];
  createdBy: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const SCOPES: Array<{ id: string; label: string; hint: string }> = [
  { id: "coordinates:read", label: "Coordinates", hint: "Read every school's point (to update TDMP's GPS)" },
  { id: "schools:read", label: "Schools", hint: "Read the school list and boundaries" },
  { id: "embed:create", label: "Embed views", hint: "Request signed links to dashboards and maps" },
];

function NewKeyNotice({ apiKey, onDone }: { apiKey: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-inset ring-amber-500/25"
      role="alert"
    >
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
      <p className="text-xs text-muted-foreground">
        Send it to the partner over a secure channel (not email in plain text). It belongs on their server only.
      </p>
      <Button className={PILL_BUTTON.small} onClick={onDone}>
        I have stored it
      </Button>
    </motion.div>
  );
}

/** Partner keys: who may read RTB GIS data and embed its views. */
export function PartnerAccess({ onChanged }: { onChanged?: (keys: PartnerKey[]) => void }) {
  const toast = useToast();
  const [keys, setKeys] = useState<PartnerKey[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [name, setName] = useState("TDMP production");
  const [partner, setPartner] = useState("TDMP");
  const [scopes, setScopes] = useState<string[]>(SCOPES.map((s) => s.id));
  const [origins, setOrigins] = useState("https://tdmp.rtb.gov.rw");

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
      });
      setNewKey(data.apiKey);
      setCreating(false);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create the key."));
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
          Partner keys let another platform's server read school coordinates and embed RTB GIS dashboards and maps. Everything they reach is read-only.
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
            className="space-y-3 overflow-hidden rounded-2xl bg-slate-900/[0.03] p-4 ring-1 ring-inset ring-slate-900/5 dark:bg-white/[0.035] dark:ring-white/8"
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
            <label className="block space-y-1 text-xs text-muted-foreground">
              Sites that may show embedded views (one per line)
              <textarea value={origins} onChange={(e) => setOrigins(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background p-2 font-mono text-xs text-foreground" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className={PILL_BUTTON.small} onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" className={PILL_BUTTON.small} isLoading={saving} disabled={saving || !scopes.length}>
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
            <li key={k.id} className={cn("rounded-2xl p-3 ring-1 ring-inset", k.revokedAt ? "opacity-60 ring-slate-900/5 dark:ring-white/8" : "ring-slate-900/10 dark:ring-white/10")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {k.name}
                    <span className="font-mono text-[11px] text-muted-foreground">{k.keyPrefix}…</span>
                    {k.revokedAt ? <StatusPill tone="neutral">Revoked</StatusPill> : <StatusPill tone="good">Active</StatusPill>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
                    <Button variant="outline" className={PILL_BUTTON.small} onClick={() => setConfirmRevoke(k.id)} data-tooltip="Stop this key working; open embedded views end at once">
                      <Ban className="h-3.5 w-3.5" aria-hidden /> Revoke
                    </Button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
