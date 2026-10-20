import { useId, useMemo, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { api } from "../../lib/api";
import { useAuthorization } from "../../hooks/useAuthorization";
import { Permission, type PermissionType } from "../../lib/permissions";
import { CHANGE_FIELDS, type ChangeField } from "./change-request-fields";

interface Row {
  key: string;
  field: string;
  proposedValue: string;
}

let rowSeq = 0;
const newRow = (field = ""): Row => ({ key: `r${++rowSeq}`, field, proposedValue: "" });

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (Array.isArray(v)) return `${v.length} item(s)`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * "Request a change" (WS7.7): a user who cannot edit a locked field
 * (location, identity, buildings…) proposes a new value with a reason. The
 * server files it as a data_change_request report routed to the GIS analysts.
 */
export function RequestChangeDialog({
  isOpen,
  onClose,
  schoolId,
  school,
  initialFields,
}: {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  /** Current school record, to show "current value" next to each field. */
  school?: Record<string, unknown> | null;
  /** Pre-select these fields (e.g. the locked step the user clicked). */
  initialFields?: string[];
}) {
  const toast = useToast();
  const { isAuthorized } = useAuthorization();
  const reasonId = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    initialFields?.length ? initialFields.map((f) => newRow(f)) : [newRow()],
  );
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  // Offer only the fields this user cannot edit directly.
  const lockedFields = useMemo(() => {
    const canManage = isAuthorized(Permission.MANAGE_SCHOOLS);
    return CHANGE_FIELDS.filter(
      (f) => !canManage && !f.permissions.some((p) => isAuthorized(p as PermissionType)),
    );
  }, [isAuthorized]);

  const byKey = useMemo(
    () => new Map<string, ChangeField>(CHANGE_FIELDS.map((f) => [f.field, f])),
    [],
  );

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const valid =
    reason.trim().length >= 5 &&
    rows.length > 0 &&
    rows.every((r) => r.field && r.proposedValue.trim()) &&
    new Set(rows.map((r) => r.field)).size === rows.length;

  const submit = async () => {
    if (!valid) return;
    setSending(true);
    try {
      await api.post(`/schools/${schoolId}/change-requests`, {
        fields: rows.map((r) => {
          const meta = byKey.get(r.field);
          const raw = r.proposedValue.trim();
          const num = Number(raw);
          return {
            field: r.field,
            proposedValue: meta?.numeric && raw !== "" && Number.isFinite(num) ? num : raw,
          };
        }),
        reason: reason.trim(),
      });
      toast.success(
        "Your request was sent to the GIS team. You will get a notification when it is handled.",
        { title: "Change requested" },
      );
      setRows([newRow()]);
      setReason("");
      onClose();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      toast.error(Array.isArray(m) ? m.join("\n") : m || "Please try again.", {
        title: "Could not send the request",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request a change"
      description="Some details can only be changed by the GIS team. Tell them what is wrong and they will update the record."
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid} isLoading={sending}>
            {!sending && <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {rows.map((r, i) => {
          const meta = byKey.get(r.field);
          const fieldId = `${reasonId}-f-${r.key}`;
          const valueId = `${reasonId}-v-${r.key}`;
          return (
            <fieldset key={r.key} className="rounded-2xl border border-border/60 p-3 space-y-2">
              <legend className="px-1 text-xs font-medium text-muted-foreground">Change {i + 1}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
                    What should change?
                  </label>
                  <select
                    id={fieldId}
                    value={r.field}
                    onChange={(e) => update(r.key, { field: e.target.value })}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Choose a detail…</option>
                    {lockedFields.map((f) => (
                      <option
                        key={f.field}
                        value={f.field}
                        disabled={rows.some((o) => o.key !== r.key && o.field === f.field)}
                      >
                        {f.group}: {f.label}
                      </option>
                    ))}
                  </select>
                  {meta && (
                    <p className="text-xs text-muted-foreground">
                      Current: <span className="font-medium text-foreground">{show(school?.[r.field])}</span>
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor={valueId} className="text-sm font-medium text-foreground">
                    Correct value
                  </label>
                  <input
                    id={valueId}
                    value={r.proposedValue}
                    onChange={(e) => update(r.key, { proposedValue: e.target.value })}
                    inputMode={meta?.numeric ? "decimal" : undefined}
                    placeholder={meta?.hint ?? "New value"}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((o) => o.key !== r.key))}
                  className="inline-flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove this change
                </button>
              )}
            </fieldset>
          );
        })}

        {rows.length < 10 && (
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, newRow()])}
            className="inline-flex items-center gap-1.5 rounded-md px-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add another detail
          </button>
        )}

        <div className="space-y-1">
          <label htmlFor={reasonId} className="text-sm font-medium text-foreground">
            Why is this change needed?
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. The map pin is on the neighbouring plot; the main gate is 200 m north."
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">At least 5 characters.</p>
        </div>
      </div>
    </Modal>
  );
}
