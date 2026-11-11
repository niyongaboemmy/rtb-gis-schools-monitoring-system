import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { titleCase } from "../../lib/labels";
import { useToast } from "../ui/toast";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { PILL_BUTTON } from "../ui/surfaces";

interface RoleWithTdmp {
  id: string;
  name: string;
  tdmpRoleNames?: string[] | null;
}

/** Splits "a, b" into trimmed, non-empty names. */
function parseNames(text: string): string[] {
  return text
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * The TDMP role names that map to this RTB GIS role. Each change is saved
 * straight away (PATCH /roles/:id { tdmpRoleNames }).
 */
export function TdmpRoleNames<T extends RoleWithTdmp>({
  role,
  onSaved,
}: {
  role: T;
  onSaved: (updated: T) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const names = role.tdmpRoleNames ?? [];
  const inputId = `tdmp-roles-${role.id}`;
  const hintId = `${inputId}-hint`;

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      const res = await api.patch<T>(`/roles/${role.id}`, { tdmpRoleNames: next });
      onSaved(res.data);
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not update the TDMP roles for ${titleCase(role.name)}.`));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const lower = new Set(names.map((n) => n.toLowerCase()));
    const fresh = parseNames(draft).filter((n) => !lower.has(n.toLowerCase()));
    if (!fresh.length) {
      setDraft("");
      return;
    }
    if (await save([...names, ...fresh])) setDraft("");
  };

  const remove = (name: string) => void save(names.filter((n) => n !== name));

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-background/70 px-4 py-3 ring-1 ring-inset ring-border/40 min-[400px]:mx-5 sm:mx-6 dark:bg-background/40">
      <label htmlFor={inputId} className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        TDMP roles that get this role
      </label>
      <p id={hintId} className="mt-1 text-xs text-muted-foreground/80">
        People signing in from TDMP with any of these TDMP role names get this role. A TDMP user whose roles match
        nothing cannot sign in.
      </p>

      {names.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="TDMP role names">
          {names.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-[13px] text-primary"
            >
              <span className="font-mono">{name}</span>
              <button
                type="button"
                onClick={() => remove(name)}
                disabled={busy}
                aria-label={`Remove TDMP role ${name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-2.5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          id={inputId}
          aria-describedby={hintId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={names.length ? "Add another TDMP role" : "e.g. school_admin"}
          className="h-9 rounded-xl"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" variant="outline" className={PILL_BUTTON.small} disabled={busy || !draft.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          Add
        </Button>
      </form>
    </div>
  );
}
