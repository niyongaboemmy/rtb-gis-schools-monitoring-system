import { motion, useReducedMotion } from "framer-motion";

const WORDS = [
  { text: "National", accent: false },
  { text: "View", accent: true },
] as const;

/**
 * Dashboard headline in brand primary only: the first word in the text
 * colour, the accent word in --primary with its own underline. Words rise in
 * one by one, the underline draws itself, and hovering sends a light sheen
 * across the accent.
 */
export function HeroTitle() {
  const reduce = useReducedMotion();
  return (
    <h1 className="group/title pointer-events-auto relative w-fit cursor-default whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[-0.01em]">
      {WORDS.map(({ text, accent }, i) => (
        <motion.span
          key={text}
          initial={reduce ? false : { opacity: 0, y: "0.45em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
          className={accent ? "relative inline-block" : "inline-block text-foreground dark:text-white"}
        >
          {accent ? (
            <>
              <span className="ht-accent bg-clip-text font-bold text-transparent">{text}</span>
              {/* Primary underline: drawn on load, extends on hover */}
              <motion.span
                aria-hidden
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -bottom-0.5 left-0 h-[1.5px] w-full origin-left rounded-full bg-primary/80 shadow-[0_0_12px_hsl(var(--primary)/0.6)] transition-transform duration-500 group-hover/title:scale-x-110"
              />
            </>
          ) : (
            text
          )}
          {i < WORDS.length - 1 ? " " : ""}
        </motion.span>
      ))}

      <style>{`
        .ht-accent {
          background-image: linear-gradient(100deg,
            hsl(var(--primary)) 0%, hsl(var(--primary)) 40%,
            hsl(var(--primary) / 0.55) 50%,
            hsl(var(--primary)) 60%, hsl(var(--primary)) 100%);
          background-size: 250% 100%;
          background-position: 100% 0;
          transition: background-position 0s;
        }
        .group\\/title:hover .ht-accent {
          background-position: 0% 0;
          transition: background-position 1.1s cubic-bezier(.22,1,.36,1);
        }
        @media (prefers-reduced-motion: reduce) {
          .group\\/title:hover .ht-accent { transition: none; background-position: 100% 0; }
        }
      `}</style>
    </h1>
  );
}
