"use client";
import "../global.css";
import {
  useRef,
  useLayoutEffect,
  useCallback,
  type ReactNode,
} from "react";

const LEAF_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "a",
  "button",
  "li",
  "td",
  "th",
  "label",
  "img",
  "video",
  "input",
  "textarea",
  "strong",
  "em",
  "b",
  "i",
  "cite",
  "code",
]);

const HEADING_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/** Body copy: line-based placeholders follow line-height. */
const PARAGRAPH_LIKE_TAGS = new Set([
  "p",
  "li",
  "td",
  "th",
  "label",
  "textarea",
]);

/** Tailwind `rounded-lg` (0.5rem) — default bone corners unless element is more rounded. */
const SK_RADIUS_LG_PX = 8;

/** One drawable region: either a whole element or a text run inside a heading/paragraph. */
type SkeletonTarget =
  | { kind: "element"; el: HTMLElement }
  | {
      kind: "text";
      text: Text;
      /** Use parent block typography (line-height, font-size) for line bars. */
      blockRole: "heading" | "paragraph";
    };

function parsePx(val: string, fallback: number): number {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

function effectiveLineHeightPx(
  cs: CSSStyleDeclaration,
  fontSizePx: number,
): number {
  const lh = cs.lineHeight;
  if (!lh || lh === "normal") return fontSizePx * 1.25;
  if (/px$/i.test(lh)) return parsePx(lh, fontSizePx * 1.25);
  const n = parseFloat(lh);
  if (Number.isFinite(n)) {
    if (n < 10) return n * fontSizePx;
    return n;
  }
  return fontSizePx * 1.25;
}

function contentInset(
  node: HTMLElement,
  borderBox: DOMRect,
): { left: number; top: number; width: number; height: number } {
  const cs = getComputedStyle(node);
  const pl = parsePx(cs.paddingLeft, 0);
  const pr = parsePx(cs.paddingRight, 0);
  const pt = parsePx(cs.paddingTop, 0);
  const pb = parsePx(cs.paddingBottom, 0);
  return {
    left: borderBox.left + pl,
    top: borderBox.top + pt,
    width: Math.max(0, borderBox.width - pl - pr),
    height: Math.max(0, borderBox.height - pt - pb),
  };
}

function pickBorderRadius(cs: CSSStyleDeclaration, barHeight: number): string {
  const token = cs.borderRadius.trim().split(/\s+/)[0] ?? "";
  if (token.includes("%")) return token;
  const px = parseFloat(token);
  const cap = Math.max(2, barHeight / 2);
  const floorLg = Math.min(SK_RADIUS_LG_PX, cap);
  if (Number.isFinite(px)) {
    return `${Math.max(floorLg, Math.min(px, cap))}px`;
  }
  return `${floorLg}px`;
}

/** Solid blocks: at least rounded-lg unless the node is explicitly sharper. */
function solidBlockRadius(cs: CSSStyleDeclaration, r: DOMRect): string {
  const radiusRaw = cs.borderRadius.trim().split(/\s+/)[0] ?? "";
  if (radiusRaw.includes("%")) return radiusRaw;
  const px = parseFloat(radiusRaw);
  const cap = Math.min(r.width, r.height) / 2;
  const floorLg = Math.min(SK_RADIUS_LG_PX, cap);
  if (Number.isFinite(px)) {
    return `${Math.max(floorLg, Math.min(px, cap))}px`;
  }
  return `${floorLg}px`;
}

function parseGapCss(gapCss: string): number {
  const first = gapCss.trim().split(/\s+/)[0] ?? "0";
  return parsePx(first, 0);
}

function countGridColumns(cs: CSSStyleDeclaration): number {
  const t = cs.gridTemplateColumns?.trim();
  if (!t || t === "none") return 1;
  const parts = t.split(/\s+/).filter((p) => p.length > 0);
  return Math.max(1, parts.length);
}

function visibleDirectChildren(el: HTMLElement): HTMLElement[] {
  return Array.from(el.children).filter((c) => {
    const h = c as HTMLElement;
    const s = getComputedStyle(h);
    if (s.display === "none" || s.visibility === "hidden") return false;
    if (h.getAttribute("aria-hidden") === "true") return false;
    const br = h.getBoundingClientRect();
    return br.width >= 4 && br.height >= 4;
  }) as HTMLElement[];
}

/**
 * Mark list/grid wrappers from `.map()` with `data-sk-map-min="3"` so loading shows
 * at least N card-sized bones following CSS Grid tracks (gap + template columns).
 */
function appendGridMapMinPhantoms(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  contentRoot: HTMLElement,
) {
  const grids = contentRoot.querySelectorAll<HTMLElement>("[data-sk-map-min]");
  const boneRadius = (w: number, h: number) =>
    `${Math.min(SK_RADIUS_LG_PX, Math.min(w, h) / 2)}px`;

  grids.forEach((grid) => {
    const raw = grid.getAttribute("data-sk-map-min") ?? "3";
    const minItems = Math.max(1, parseInt(raw, 10) || 3);

    const pcs = getComputedStyle(grid);
    if (pcs.display !== "grid") return;

    const kids = visibleDirectChildren(grid);
    if (kids.length >= minItems) return;

    const needed = minItems - kids.length;
    const cols = countGridColumns(pcs);
    const gapX = parseGapCss(pcs.columnGap || pcs.gap || "0");
    const gapY = parseGapCss(pcs.rowGap || pcs.gap || "0");

    const gridBox = grid.getBoundingClientRect();
    let cellW: number;
    let cellH: number;
    let originLeft: number;
    let originTop: number;
    let stepX: number;
    let stepY: number;

    if (kids.length > 0) {
      const r0 = kids[0].getBoundingClientRect();
      cellW = r0.width;
      cellH = r0.height;
      originLeft = r0.left;
      originTop = r0.top;
      stepX = cellW + gapX;
      stepY = cellH + gapY;
      if (kids.length >= 2) {
        const r1 = kids[1].getBoundingClientRect();
        if (Math.abs(r1.top - r0.top) < 8) {
          stepX = r1.left - r0.left;
        } else {
          stepY = r1.top - r0.top;
        }
      }
    } else {
      const padL = parsePx(pcs.paddingLeft, 0);
      const padT = parsePx(pcs.paddingTop, 0);
      const innerW =
        grid.clientWidth -
        parsePx(pcs.paddingLeft, 0) -
        parsePx(pcs.paddingRight, 0);
      cellW = Math.max(48, (innerW - gapX * Math.max(0, cols - 1)) / cols);
      cellH = Math.max(64, cellW * 0.75);
      originLeft = gridBox.left + padL;
      originTop = gridBox.top + padT;
      stepX = cellW + gapX;
      stepY = cellH + gapY;
    }

    for (let k = 0; k < needed; k++) {
      const idx = kids.length + k;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const left = originLeft + col * stepX - wrapRect.left;
      const top = originTop + row * stepY - wrapRect.top;
      appendBone(top, left, cellW, cellH, boneRadius(cellW, cellH));
    }
  });
}

/** Text node + inline element siblings → split skeletons (e.g. h1: “Welcome ” + gradient span). */
function shouldExpandMixedBlock(node: HTMLElement): boolean {
  const hasElt = node.children.length > 0;
  const hasDirectText = Array.from(node.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n as Text).data.trim().length > 0,
  );
  return hasElt && hasDirectText;
}

function rectFromTextNode(text: Text): DOMRect | null {
  try {
    const range = document.createRange();
    range.selectNodeContents(text);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return r;
  } catch {
    return null;
  }
}

function collectSkeletonTargets(root: HTMLElement): SkeletonTarget[] {
  const targets: SkeletonTarget[] = [];

  function walk(node: HTMLElement) {
    if (node === root) {
      if (
        root.childElementCount === 0 &&
        root.textContent?.trim() &&
        root.getBoundingClientRect().height >= 2
      ) {
        targets.push({ kind: "element", el: root });
        return;
      }
      Array.from(node.children).forEach((c) => walk(c as HTMLElement));
      return;
    }

    const tag = node.tagName.toLowerCase();
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return;
    if (node.getAttribute("aria-hidden") === "true") return;

    // Headings / paragraphs: map each text run + inline child separately when mixed.
    if (HEADING_TAGS.has(tag) || tag === "p") {
      const blockRole = HEADING_TAGS.has(tag) ? "heading" : "paragraph";
      if (shouldExpandMixedBlock(node)) {
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            const t = child as Text;
            if (t.data.trim()) targets.push({ kind: "text", text: t, blockRole });
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            walk(child as HTMLElement);
          }
        }
        return;
      }
      targets.push({ kind: "element", el: node });
      return;
    }

    if (LEAF_TAGS.has(tag)) {
      targets.push({ kind: "element", el: node });
      return;
    }

    if (node.children.length === 0 && node.textContent?.trim()) {
      targets.push({ kind: "element", el: node });
      return;
    }

    Array.from(node.children).forEach((c) => walk(c as HTMLElement));
  }

  walk(root);
  return targets;
}

type AppendBone = (
  top: number,
  left: number,
  width: number,
  height: number,
  borderRadius: string,
) => void;

/** Line stacks inside an arbitrary content box (used for Range text fragments). */
function appendLineSkeletonInBox(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  inner: { left: number; top: number; width: number; height: number },
  cs: CSSStyleDeclaration,
  opts: {
    barHeightFactor: number;
    maxLines: number;
    lastLineMinRatio: number;
  },
) {
  if (inner.width < 4 || inner.height < 4) return;

  const fontSize = parsePx(cs.fontSize, 16);
  const lineStep = effectiveLineHeightPx(cs, fontSize);
  const rawLines = Math.round(inner.height / Math.max(lineStep * 0.82, 1));
  const numLines = Math.max(
    1,
    Math.min(opts.maxLines, Number.isFinite(rawLines) ? rawLines : 1),
  );

  const barH = Math.max(
    5,
    Math.min(lineStep * opts.barHeightFactor, inner.height),
  );
  const radius = pickBorderRadius(cs, barH);

  for (let i = 0; i < numLines; i++) {
    const lineTop = inner.top + i * lineStep + (lineStep - barH) / 2;
    let w = inner.width;
    if (i === numLines - 1 && numLines > 1) {
      w = Math.max(
        inner.width * opts.lastLineMinRatio,
        Math.min(inner.width * 0.92, inner.width - 4),
      );
    }
    appendBone(
      lineTop - wrapRect.top,
      inner.left - wrapRect.left,
      w,
      barH,
      radius,
    );
  }
}

function appendLineSkeleton(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  node: HTMLElement,
  borderBox: DOMRect,
  opts: {
    barHeightFactor: number;
    maxLines: number;
    lastLineMinRatio: number;
  },
) {
  const cs = getComputedStyle(node);
  const inner = contentInset(node, borderBox);
  appendLineSkeletonInBox(appendBone, wrapRect, inner, cs, opts);
}

function appendHeadingSkeleton(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  node: HTMLElement,
  borderBox: DOMRect,
) {
  appendLineSkeleton(appendBone, wrapRect, node, borderBox, {
    barHeightFactor: 0.72,
    maxLines: 4,
    lastLineMinRatio: 0.5,
  });
}

function appendParagraphSkeleton(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  node: HTMLElement,
  borderBox: DOMRect,
) {
  appendLineSkeleton(appendBone, wrapRect, node, borderBox, {
    barHeightFactor: 0.58,
    maxLines: 24,
    lastLineMinRatio: 0.52,
  });
}

function appendImageLikeBone(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  node: HTMLElement,
  r: DOMRect,
) {
  const cs = getComputedStyle(node);
  const radiusRaw = cs.borderRadius;
  const radiusPx = parseFloat(radiusRaw);
  const isCircle =
    node.tagName.toLowerCase() === "img" &&
    (radiusRaw.includes("%") ? radiusPx >= 45 : radiusPx >= r.height / 2);

  appendBone(
    r.top - wrapRect.top,
    r.left - wrapRect.left,
    r.width,
    r.height,
    isCircle ? "50%" : `${Math.min(SK_RADIUS_LG_PX, Math.min(r.width, r.height) / 2)}px`,
  );
}

function appendSolidBlockBone(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  node: HTMLElement,
  r: DOMRect,
) {
  const cs = getComputedStyle(node);
  const radius = solidBlockRadius(cs, r);
  appendBone(r.top - wrapRect.top, r.left - wrapRect.left, r.width, r.height, radius);
}

function paintElementTarget(
  appendBone: AppendBone,
  wrapRect: DOMRect,
  node: HTMLElement,
) {
  const r = node.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;

  const tag = node.tagName.toLowerCase();
  const cs = getComputedStyle(node);
  const fontSize = parsePx(cs.fontSize, 16);

  if (tag === "img" || tag === "video") {
    appendImageLikeBone(appendBone, wrapRect, node, r);
    return;
  }

  if (HEADING_TAGS.has(tag)) {
    appendHeadingSkeleton(appendBone, wrapRect, node, r);
    return;
  }

  if (PARAGRAPH_LIKE_TAGS.has(tag)) {
    appendParagraphSkeleton(appendBone, wrapRect, node, r);
    return;
  }

  if (tag === "span" || tag === "strong" || tag === "em" || tag === "b" || tag === "i" || tag === "cite") {
    if (r.height > effectiveLineHeightPx(cs, fontSize) * 1.65) {
      appendParagraphSkeleton(appendBone, wrapRect, node, r);
    } else {
      appendSolidBlockBone(appendBone, wrapRect, node, r);
    }
    return;
  }

  if (tag === "code") {
    appendSolidBlockBone(appendBone, wrapRect, node, r);
    return;
  }

  if (tag === "a" || tag === "button" || tag === "input") {
    appendSolidBlockBone(appendBone, wrapRect, node, r);
    return;
  }

  if (r.height > fontSize * 1.65) {
    appendParagraphSkeleton(appendBone, wrapRect, node, r);
  } else {
    appendSolidBlockBone(appendBone, wrapRect, node, r);
  }
}

function applySkeletons(wrap: HTMLElement, content: HTMLElement) {
  wrap.querySelectorAll(".sk-bone").forEach((e) => e.remove());

  const wrapRect = wrap.getBoundingClientRect();
  const targets = collectSkeletonTargets(content);

  const appendBone: AppendBone = (top, left, width, height, borderRadius) => {
    const bone = document.createElement("div");
    bone.className = "sk-bone";
    bone.style.cssText = `top:${top}px;left:${left}px;width:${width}px;height:${height}px;border-radius:${borderRadius};`;
    wrap.appendChild(bone);
  };

  if (targets.length === 0) {
    const r = content.getBoundingClientRect();
    if (r.width >= 2 && r.height >= 2) {
      appendBone(
        r.top - wrapRect.top,
        r.left - wrapRect.left,
        r.width,
        r.height,
        `${Math.min(SK_RADIUS_LG_PX, Math.min(r.width, r.height) / 2)}px`,
      );
    }
  }

  for (const t of targets) {
    if (t.kind === "element") {
      paintElementTarget(appendBone, wrapRect, t.el);
      continue;
    }

    const parent = t.text.parentElement;
    if (!parent) continue;
    const r = rectFromTextNode(t.text);
    if (!r) continue;
    const cs = getComputedStyle(parent);
    const inner = {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    };
    if (t.blockRole === "heading") {
      appendLineSkeletonInBox(appendBone, wrapRect, inner, cs, {
        barHeightFactor: 0.72,
        maxLines: 4,
        lastLineMinRatio: 0.5,
      });
    } else {
      appendLineSkeletonInBox(appendBone, wrapRect, inner, cs, {
        barHeightFactor: 0.58,
        maxLines: 24,
        lastLineMinRatio: 0.52,
      });
    }
  }

  appendGridMapMinPhantoms(appendBone, wrapRect, content);

  wrap.style.minHeight = `${content.offsetHeight}px`;
}

function removeSkeletons(wrap: HTMLElement, content: HTMLElement) {
  wrap.querySelectorAll(".sk-bone").forEach((e) => e.remove());
  content.style.visibility = "";
  wrap.style.minHeight = "";
}

export interface SkeletonProps {
  className?: string;
  /**
   * When `children` is passed: if true (default), show auto placeholders from layout;
   * if false, show real content only.
   */
  loading?: boolean;
  /**
   * Omit for a shadcn-style placeholder: set size/shape with `className`
   * (e.g. `h-12 w-12 rounded-full`, `h-4 w-[250px]`).
   */
  children?: ReactNode;
}

/**
 * Two modes:
 * 1. **Primitive** — `<Skeleton className="h-12 w-12 rounded-full" />` (same idea as shadcn/ui).
 * 2. **Auto** — `<Skeleton loading><YourComponent /></Skeleton>` measures real DOM and draws matching bones.
 *
 * **Mapped lists:** on the grid (or `display:grid`) wrapper around `.map()`, add
 * `data-sk-map-min="3"` so at least 3 item-sized placeholders show when there are fewer cells.
 */
export function Skeleton({ className, loading: loadingProp, children }: SkeletonProps) {
  if (children == null) {
    return (
      <div
        className={["sk-primitive", className].filter(Boolean).join(" ")}
        aria-hidden
      />
    );
  }

  const loading = loadingProp ?? true;
  return (
    <SkeletonAutoMeasure className={className} loading={loading}>
      {children}
    </SkeletonAutoMeasure>
  );
}

function SkeletonAutoMeasure({
  className,
  loading,
  children,
}: {
  className?: string;
  loading: boolean;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const apply = useCallback(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;

    if (loading) {
      // Measure while visible: some engines under-report rects if subtree is visibility:hidden.
      content.style.visibility = "";
      applySkeletons(wrap, content);
      content.style.visibility = "hidden";
    } else {
      removeSkeletons(wrap, content);
    }
  }, [loading]);

  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useLayoutEffect(() => {
    if (!loading) return;
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => apply());
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [loading, apply]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
      }}
      className={className}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
