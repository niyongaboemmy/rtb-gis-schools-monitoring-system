import { useState, type ReactNode } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { cn } from "../../lib/utils";
import { LangContext, LANGS, readLang, saveLang, useLang, type Lang } from "./lang";

/** Shares the chosen language with every code sample below it, and remembers it. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-white/10", className)}
      data-tooltip={label}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <ClipboardCopy className="h-3 w-3" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Light syntax colouring for JSON / JS / Python / PHP / shell samples. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re =
    /(\/\/[^\n]*|#(?![!{])[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|await|async|for|if|else|return|import|from|def|while|True|False|None|null|true|false|new|function|throw|try|catch|echo|use|fn)\b|(\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [text, comment, str, kw, num] = m;
    const cls = comment ? "text-slate-500" : str ? "text-emerald-300" : kw ? "text-sky-300" : num ? "text-amber-300" : "";
    out.push(
      <span key={i++} className={cls}>
        {text}
      </span>,
    );
    last = m.index + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function Code({ code, label, actions }: { code: string; label?: string; actions?: ReactNode }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-slate-950 shadow-sm ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="flex items-center gap-1.5 truncate text-[11px] font-medium text-slate-400">
          <span className="flex gap-1" aria-hidden>
            <i className="h-2 w-2 rounded-full bg-rose-400/70" />
            <i className="h-2 w-2 rounded-full bg-amber-300/70" />
            <i className="h-2 w-2 rounded-full bg-emerald-400/70" />
          </span>
          {label ?? ""}
        </span>
        <span className="flex items-center gap-1">
          {actions}
          <CopyButton text={code} />
        </span>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3 text-[12px] leading-relaxed text-slate-100">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}

/** The same example in every language; the tab follows the page-wide choice. */
export function CodeTabs({ examples, label }: { examples: Partial<Record<Lang, string>>; label?: string }) {
  const { lang, setLang } = useLang();
  const langs = LANGS.filter((l) => examples[l]);
  const shown = examples[lang] ? lang : langs[0];
  return (
    <div className="min-w-0 space-y-2">
      <div role="tablist" aria-label="Language" className="inline-flex flex-wrap rounded-full bg-slate-900/[0.05] p-0.5 dark:bg-white/[0.06]">
        {langs.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={shown === l}
            onClick={() => setLang(l)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", shown === l ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {l}
          </button>
        ))}
      </div>
      <Code code={examples[shown] ?? ""} label={label ? `${label} · ${shown}` : shown} />
    </div>
  );
}
