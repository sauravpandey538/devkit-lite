"use client";

import "../screen-cat.css";
import { useCallback, useEffect, useRef, useState } from "react";

/** Twemoji cat face U+1F431 (CC-BY 4.0) — swap via `imageSrc` for your own PNG. */
export const DEFAULT_SCREEN_CAT_SRC =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f431.png";

const STRIP_EXTRA = 56;
const EDGE_PAD = 16;
const BOTTOM_OFFSET = 10;
/** Initial silence before any chat bubble; same length as gaps between lines. */
const INTRO_SILENCE_MS = 5000;
/** After each chat line (and after an escape line), hide the bubble this long before the next line. */
const BETWEEN_LINES_SILENCE_MS = 5000;
/** How long a motivation/funny line stays visible before the quiet gap. */
const LINE_DISPLAY_MS_MIN = 5500;
const LINE_DISPLAY_MS_MAX = 8000;

/** 70% of rotating lines come from here */
const MOTIVATION_LINES = [
  "Small steps. Big ships.",
  "Your future self will thank this commit.",
  "Progress beats perfection. Ship it.",
  "Debug like a detective. Ship like a boss.",
  "One tab, one task — you've got this.",
  "Curiosity is your superpower.",
  "Refactor fearlessly; tests have your back.",
  "Today’s grind is tomorrow’s glide.",
  "You’re closer than you think.",
  "Build in public. Celebrate in private.",
  "Consistency compounds.",
  "Ship the scary thing first.",
];

/** 30% of rotating lines */
const FUNNY_LINES = [
  "I'm not lazy — I'm on battery saver.",
  "Meow are you doing today?",
  "This bug is afraid of you. Probably.",
  "I believe in you. And naps.",
  "404: motivation not found… kidding, it’s right here.",
  "Rubber duck? I’m rubber cat.",
  "git blame? Never heard of her.",
  "I’d pair-program but I only have paws.",
  "Your code runs. My tail purrs.",
  "Stack overflow is a mood, not a site.",
];

/** Shown after the cat is poked — pick at random */
const ESCAPE_LINES = [
  "Touch code not me!",
  "Paws off — I’m off the critical path.",
  "You ship features, not fur.",
  "That interaction wasn’t in the spec.",
  "I’m union. File a ticket.",
  "Nope. Refactor your own tail.",
  "Hey! I’m not a hotfix.",
  "Save the clicks for your IDE.",
];

const MOTIVATION_WEIGHT = 0.7;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickWeightedBubbleLine(): string {
  return Math.random() < MOTIVATION_WEIGHT
    ? pickRandom(MOTIVATION_LINES)
    : pickRandom(FUNNY_LINES);
}

export interface ScreenCatProps {
  /** Image URL for the mascot (PNG/WebP). */
  imageSrc?: string;
  /** Box size in px (width & height). Default 96. */
  size?: number;
  /** Fixed stacking order. Default 9999. */
  zIndex?: number;
  className?: string;
}

type Mood = "walk" | "idle" | "hop" | "wiggle" | "spin";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Bottom-of-viewport pet: ~5s quiet intro, then repeating cycle — show a line, ~5s quiet,
 * next line (70% motivation / 30% funny). Tap-to-teleport shows an escape line, then
 * the same quiet gap before chat resumes.
 * Import `devkit-lite/style.css` for bundled styles.
 */
export function ScreenCat({
  imageSrc = DEFAULT_SCREEN_CAT_SRC,
  size = 96,
  zIndex = 9999,
  className,
}: ScreenCatProps) {
  const [x, setX] = useState<number | null>(null);
  const [facing, setFacing] = useState(1);
  const [mood, setMood] = useState<Mood>("idle");
  const [moodKey, setMoodKey] = useState(0);
  const [bubbleText, setBubbleText] = useState("");
  const [introComplete, setIntroComplete] = useState(false);
  const [escapeActive, setEscapeActive] = useState(false);
  const [chatBubbleVisible, setChatBubbleVisible] = useState(false);
  const [vanish, setVanish] = useState(false);
  const prevXRef = useRef(0);
  const escapeModeRef = useRef(false);
  const tapLockRef = useRef(false);
  const introCompleteRef = useRef(false);
  const chatTimersRef = useRef<{ line?: number; quiet?: number }>({});

  const showBubble = escapeActive || chatBubbleVisible;
  const isWarmup = !introComplete;

  const clearChatCycle = useCallback(() => {
    const t = chatTimersRef.current;
    if (t.line != null) window.clearTimeout(t.line);
    if (t.quiet != null) window.clearTimeout(t.quiet);
    t.line = t.quiet = undefined;
  }, []);

  /** One full step: show weighted line → visible window → quiet → recurse (until escape cancels timers). */
  const runChatCycleRef = useRef<() => void>(() => {});

  runChatCycleRef.current = () => {
    clearChatCycle();
    if (!introCompleteRef.current || escapeModeRef.current) return;
    setChatBubbleVisible(true);
    setBubbleText(pickWeightedBubbleLine());
    const lineMs =
      LINE_DISPLAY_MS_MIN +
      Math.random() * (LINE_DISPLAY_MS_MAX - LINE_DISPLAY_MS_MIN);
    chatTimersRef.current.line = window.setTimeout(() => {
      if (escapeModeRef.current) return;
      setChatBubbleVisible(false);
      chatTimersRef.current.quiet = window.setTimeout(() => {
        if (escapeModeRef.current) return;
        runChatCycleRef.current();
      }, BETWEEN_LINES_SILENCE_MS);
    }, lineMs);
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      introCompleteRef.current = true;
      setIntroComplete(true);
      if (!escapeModeRef.current) {
        runChatCycleRef.current();
      }
    }, INTRO_SILENCE_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => () => clearChatCycle(), [clearChatCycle]);

  const pickWalkTarget = useCallback(() => {
    if (typeof window === "undefined" || vanish) return;
    const maxX = Math.max(EDGE_PAD, window.innerWidth - size - EDGE_PAD);
    const next = EDGE_PAD + Math.random() * (maxX - EDGE_PAD);
    setFacing(next >= prevXRef.current - 1 ? 1 : -1);
    prevXRef.current = next;
    setX(next);
    setMood("walk");
  }, [size, vanish]);

  const randomAntic = useCallback(() => {
    if (vanish) return;
    const roll = Math.random();
    if (roll < 0.24) {
      setMoodKey((k) => k + 1);
      setMood("hop");
      window.setTimeout(() => setMood("idle"), 520);
    } else if (roll < 0.42) {
      setMoodKey((k) => k + 1);
      setMood("wiggle");
      window.setTimeout(() => setMood("idle"), 680);
    } else if (roll < 0.54) {
      setMoodKey((k) => k + 1);
      setMood("spin");
      window.setTimeout(() => setMood("idle"), 800);
    } else {
      setMood("idle");
    }
  }, [vanish]);

  useEffect(() => {
    const init = () => {
      const maxX = Math.max(EDGE_PAD, window.innerWidth - size - EDGE_PAD);
      const start = EDGE_PAD + Math.random() * (maxX - EDGE_PAD);
      prevXRef.current = start;
      setX(start);
    };
    init();

    const onResize = () => {
      setX((cur) => {
        if (cur == null) return cur;
        const maxX = Math.max(EDGE_PAD, window.innerWidth - size - EDGE_PAD);
        return clamp(cur, EDGE_PAD, maxX);
      });
    };
    window.addEventListener("resize", onResize);

    const walkId = window.setInterval(() => {
      pickWalkTarget();
    }, 4500 + Math.random() * 5500);

    const anticId = window.setInterval(() => {
      randomAntic();
    }, 3400 + Math.random() * 4200);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearInterval(walkId);
      window.clearInterval(anticId);
    };
  }, [pickWalkTarget, randomAntic, size]);

  const teleportFromPoke = useCallback(() => {
    if (tapLockRef.current || x == null || typeof window === "undefined") return;
    tapLockRef.current = true;
    clearChatCycle();
    setChatBubbleVisible(false);
    const fromX = prevXRef.current;
    escapeModeRef.current = true;
    setEscapeActive(true);
    setBubbleText(pickRandom(ESCAPE_LINES));
    setVanish(true);

    window.setTimeout(() => {
      const maxX = Math.max(EDGE_PAD, window.innerWidth - size - EDGE_PAD);
      const minSep = Math.min(140, Math.max(80, (maxX - EDGE_PAD) * 0.22));
      let next = fromX;
      for (let i = 0; i < 12; i++) {
        next = EDGE_PAD + Math.random() * (maxX - EDGE_PAD);
        if (Math.abs(next - fromX) >= minSep) break;
      }
      setFacing(next >= fromX - 1 ? 1 : -1);
      prevXRef.current = next;
      setX(next);
      setVanish(false);
      // Escape line visible briefly, then same quiet gap as between chat lines before resuming cycle.
      window.setTimeout(() => {
        escapeModeRef.current = false;
        setEscapeActive(false);
        tapLockRef.current = false;
        clearChatCycle();
        chatTimersRef.current.quiet = window.setTimeout(() => {
          if (!introCompleteRef.current || escapeModeRef.current) return;
          runChatCycleRef.current();
        }, BETWEEN_LINES_SILENCE_MS);
      }, 3200);
    }, 300);
  }, [size, x, clearChatCycle]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      teleportFromPoke();
    },
    [teleportFromPoke],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        teleportFromPoke();
      }
    },
    [teleportFromPoke],
  );

  if (x == null) return null;

  const moodClass =
    mood === "hop"
      ? "dk-sc-mood--hop"
      : mood === "wiggle"
        ? "dk-sc-mood--wiggle"
        : mood === "spin"
          ? "dk-sc-mood--spin"
          : "";

  const stripH = size + BOTTOM_OFFSET + STRIP_EXTRA;
  const rootClass = ["dk-sc-root", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass} style={{ height: stripH, zIndex }}>
      <div
        className="dk-sc-track"
        role="button"
        tabIndex={0}
        aria-label="Mascot: tap to move and hear a message"
        style={{
          left: x,
          bottom: BOTTOM_OFFSET,
          width: size,
          height: size,
          transition:
            mood === "walk" && !vanish
              ? "left 2.8s cubic-bezier(0.4, 0, 0.2, 1)"
              : "left 0.35s ease-out",
        }}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <div
          className={[
            "dk-sc-body",
            vanish ? "dk-sc-body--vanish" : "",
            isWarmup ? "dk-sc-body--warmup" : "dk-sc-body--chill",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showBubble ? (
            <div className="dk-sc-bubble" aria-live="polite">
              {bubbleText}
            </div>
          ) : null}
          <div
            className="dk-sc-flip"
            style={{
              transform: `scaleX(${facing})`,
              transition: "transform 0.22s ease-out",
            }}
          >
            {/* Sway/shimmy on a layer below mood so hop/spin animations stay on the inner wrapper. */}
            <div
              className={
                isWarmup ? "dk-sc-sway dk-sc-sway--warm" : "dk-sc-sway dk-sc-sway--chill"
              }
            >
              <div
                key={`${mood}-${moodKey}`}
                className={`dk-sc-mood ${moodClass}`.trim()}
              >
                {/* imgWrap: subtle breathe; img: blink — separate nodes avoid transform clashes. */}
                <div className="dk-sc-imgWrap">
                  <img
                    src={imageSrc}
                    alt=""
                    width={size}
                    height={size}
                    draggable={false}
                    className="dk-sc-img"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
