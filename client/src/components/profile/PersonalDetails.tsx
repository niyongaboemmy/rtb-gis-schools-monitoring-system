import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  User as UserIcon,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast } from "../ui/toast";
import type { User } from "../../store/authStore";
import { GLASS } from "../ui/surfaces";
import {
  PROFILE_LIMITS,
  changedFields,
  profileFormOf,
  profilePatch,
  setupChecklist,
  validateProfile,
  type ChecklistAction,
  type ProfileField,
  type ProfileForm,
} from "./profile-utils";

const EASE = [0.22, 1, 0.36, 1] as const;

function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-border/30 pt-6 first:border-t-0 first:pt-0 @2xl:grid-cols-[12rem_minmax(0,1fr)] @2xl:gap-8">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3" aria-hidden>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="grid gap-4 @md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

interface FieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  note?: ReactNode;
  wide?: boolean;
  dirty?: boolean;
  children: (describedBy: string | undefined) => ReactNode;
}

function Field({ id, label, icon: Icon, error, note, wide, dirty, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : note ? `${id}-note` : undefined;
  return (
    <div className={cn("space-y-1.5", wide && "@md:col-span-2")}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-normal text-foreground/80">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {label}
        <AnimatePresence>
          {dirty && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
              title="Edited"
            />
          )}
        </AnimatePresence>
      </label>
      {children(describedBy)}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="err"
            id={`${id}-error`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-normal text-destructive"
          >
            {error}
          </motion.p>
        ) : note ? (
          <p key="note" id={`${id}-note`} className="text-xs text-muted-foreground">
            {note}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const reduce = useReducedMotion();
  const C = 2 * Math.PI * 26;
  const pct = total ? done / total : 0;
  return (
    <div className="relative h-16 w-16 shrink-0 text-primary" aria-hidden>
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="5" />
        <motion.circle
          cx="30"
          cy="30"
          r="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={reduce ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: reduce ? 0 : 1.2, delay: 0.3, ease: EASE }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-normal tabular-nums text-foreground">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

interface Props {
  user: User;
  onSaved: (u: Partial<User>) => void;
  onOpenSecurity: () => void;
}

export function PersonalDetails({ user, onSaved, onOpenSecurity }: Props) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const saved = profileFormOf(user);
  const [draft, setDraft] = useState<ProfileForm>(saved);
  const [touched, setTouched] = useState<Partial<Record<ProfileField, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const inputs = useRef<Partial<Record<ProfileField, HTMLInputElement | null>>>({});

  const dirty = changedFields(saved, draft);
  const errors = validateProfile(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const shownError = (k: ProfileField) => (touched[k] ? errors[k] : undefined);

  const set = (k: ProfileField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft((d) => ({ ...d, [k]: e.target.value }));
    setServerError(null);
  };
  const blur = (k: ProfileField) => () => setTouched((t) => ({ ...t, [k]: true }));

  const discard = () => {
    setDraft(saved);
    setTouched({});
    setServerError(null);
  };

  const save = async () => {
    if (!dirty.length || saving) return;
    if (hasErrors) {
      setTouched({ firstName: true, lastName: true, phone: true, department: true });
      const first = (Object.keys(errors) as ProfileField[])[0];
      inputs.current[first]?.focus();
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const { data } = await api.patch(`/users/me/profile`, profilePatch(saved, draft));
      onSaved(data);
      setDraft(profileFormOf({ ...user, ...data }));
      setTouched({});
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2400);
      toast.success("Profile details updated");
    } catch (err) {
      setServerError(apiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/⌘+S saves while there are changes.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const checklist = setupChecklist(user);
  const doneCount = checklist.filter((i) => i.done).length;
  const runAction = (a: ChecklistAction) => {
    if (a === "security") return onOpenSecurity();
    const el = inputs.current[a];
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };

  const inputClass = "h-11 rounded-xl";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className={cn("@container relative rounded-[1.75rem] p-4 min-[400px]:p-5 sm:p-7", GLASS)}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Personal details</h2>
            <p className="mt-0.5 text-xs text-muted-foreground/70">How colleagues see you</p>
          </div>
          <kbd className="hidden rounded-md border border-border/60 px-1.5 py-0.5 font-sans text-[12px] text-muted-foreground sm:inline [@media(hover:none)]:hidden">
            Ctrl S to save
          </kbd>
        </div>

        <div className="space-y-6">
          <Section icon={UserIcon} title="Identity" hint="Your name on reports and the audit trail">
            <Field id="pf-first" label="First name" icon={UserIcon} error={shownError("firstName")} dirty={dirty.includes("firstName")}>
              {(d) => (
                <Input
                  id="pf-first"
                  ref={(el) => {
                    inputs.current.firstName = el;
                  }}
                  className={inputClass}
                  autoComplete="given-name"
                  required
                  maxLength={PROFILE_LIMITS.firstName}
                  value={draft.firstName}
                  onChange={set("firstName")}
                  onBlur={blur("firstName")}
                  aria-invalid={!!shownError("firstName")}
                  aria-describedby={d}
                />
              )}
            </Field>
            <Field id="pf-last" label="Last name" icon={UserIcon} error={shownError("lastName")} dirty={dirty.includes("lastName")}>
              {(d) => (
                <Input
                  id="pf-last"
                  ref={(el) => {
                    inputs.current.lastName = el;
                  }}
                  className={inputClass}
                  autoComplete="family-name"
                  required
                  maxLength={PROFILE_LIMITS.lastName}
                  value={draft.lastName}
                  onChange={set("lastName")}
                  onBlur={blur("lastName")}
                  aria-invalid={!!shownError("lastName")}
                  aria-describedby={d}
                />
              )}
            </Field>
          </Section>

          <Section icon={Mail} title="Contact" hint="How the GIS team reaches you">
            <Field
              id="pf-email"
              label="Email address"
              icon={Mail}
              wide
              note="Your sign-in email is managed by an administrator."
            >
              {(d) => (
                <Input
                  id="pf-email"
                  className={inputClass}
                  value={user.email}
                  readOnly
                  aria-readonly
                  aria-describedby={d}
                  rightIcon={<Lock className="h-3.5 w-3.5" aria-hidden />}
                />
              )}
            </Field>
            <Field id="pf-phone" label="Phone number" icon={Phone} error={shownError("phone")} dirty={dirty.includes("phone")}>
              {(d) => (
                <Input
                  id="pf-phone"
                  ref={(el) => {
                    inputs.current.phone = el;
                  }}
                  className={inputClass}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+250 7xx xxx xxx"
                  maxLength={PROFILE_LIMITS.phone}
                  value={draft.phone}
                  onChange={set("phone")}
                  onBlur={blur("phone")}
                  aria-invalid={!!shownError("phone")}
                  aria-describedby={d}
                />
              )}
            </Field>
          </Section>

          <Section icon={Briefcase} title="Work" hint="Where you sit in the organisation">
            <Field
              id="pf-dept"
              label="Department"
              icon={Building2}
              error={shownError("department")}
              dirty={dirty.includes("department")}
            >
              {(d) => (
                <Input
                  id="pf-dept"
                  ref={(el) => {
                    inputs.current.department = el;
                  }}
                  className={inputClass}
                  autoComplete="organization-title"
                  placeholder="e.g. Infrastructure, IT"
                  maxLength={PROFILE_LIMITS.department}
                  value={draft.department}
                  onChange={set("department")}
                  onBlur={blur("department")}
                  aria-invalid={!!shownError("department")}
                  aria-describedby={d}
                />
              )}
            </Field>
          </Section>
        </div>

        <AnimatePresence>
          {serverError && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-normal text-destructive"
            >
              <XCircle className="h-4 w-4 shrink-0" aria-hidden />
              {serverError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save bar: sticks to the bottom of the viewport while there are edits */}
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 mt-6">
          <AnimatePresence mode="wait" initial={false}>
            {dirty.length > 0 ? (
              <motion.div
                key="dirty"
                initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-background/80 p-2 pl-4 shadow-float @md:rounded-full @md:p-1.5 @md:pl-4 ring-1 ring-border/40 backdrop-blur-2xl"
              >
                <span className="flex items-center gap-2 text-xs font-normal text-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button type="button" variant="ghost" onClick={discard} disabled={saving} className="h-9 gap-1.5 rounded-full px-3 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Discard
                  </Button>
                  <Button type="submit" disabled={saving} className="group h-9 gap-1.5 rounded-full pl-4 pr-1.5 text-xs font-medium">
                    {saving ? "Saving…" : "Save changes"}
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0.5">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
                    </span>
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.p
                key="clean"
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn("flex items-center justify-end gap-1.5 text-xs", justSaved ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
              >
                {justSaved ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
                {justSaved ? "Saved" : "All changes saved"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </form>

      {/* Setup checklist */}
      <motion.aside
        aria-label="Account setup"
        initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
        className={cn("@container h-fit rounded-[1.75rem] p-4 min-[400px]:p-5 xl:sticky xl:top-4", GLASS)}
      >
        <div className="flex items-center gap-4">
          <ProgressRing done={doneCount} total={checklist.length} />
          <div>
            <p className="text-sm font-semibold text-foreground">Account setup</p>
            <p className="text-xs text-muted-foreground">
              {doneCount === checklist.length ? "Everything is in place" : `${doneCount} of ${checklist.length} steps done`}
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-1 @lg:grid-cols-2 @lg:gap-x-3">
          {checklist.map((item, i) => {
            const body = (
              <>
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                    item.done ? "bg-emerald-500 text-white" : "ring-1 ring-inset ring-border text-transparent",
                  )}
                  aria-hidden
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] font-normal", item.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground")}>
                    {item.label}
                  </span>
                  <span className="block text-[13px] text-muted-foreground">{item.hint}</span>
                </span>
                {!item.done && item.action && (
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-hidden />
                )}
              </>
            );
            return (
              <motion.li
                key={item.id}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: EASE }}
              >
                {!item.done && item.action ? (
                  <button
                    type="button"
                    onClick={() => runAction(item.action!)}
                    className="group flex w-full items-start gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                    <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                  </button>
                ) : (
                  <div className="flex items-start gap-3 p-2">
                    {body}
                    <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      </motion.aside>
    </div>
  );
}
