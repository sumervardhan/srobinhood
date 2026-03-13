"use client";

/**
 * Animated price display.
 *
 * On each price change, only the digits that changed get a slot-machine roll:
 *  - Rolling upward + green tint  → price increased
 *  - Rolling downward + red tint  → price decreased
 *  - Non-digit characters ($ , .) are never animated
 *
 * Uses font-mono + tabular-nums so digit widths are stable. Layout only shifts
 * when the number crosses a power-of-10 boundary (e.g. $999 → $1,000).
 *
 * Animation technique: the inner span is remounted (via React key change) on each
 * price update, which reliably restarts CSS animations without JS class-toggle hacks.
 */

import { useState, useEffect, useRef } from "react";
import { clsx } from "clsx";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type AnimState = {
  currentStr: string;
  prevStr: string | null;
  dir: "up" | "down" | null;
  epoch: number;
};

type Props = {
  value: number;
  className?: string;
};

export function AnimatedPrice({ value, className }: Props) {
  const prevValueRef = useRef<number>(value);

  const [anim, setAnim] = useState<AnimState>({
    currentStr: fmt(value),
    prevStr: null,
    dir: null,
    epoch: 0,
  });

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value) return;
    const newStr = fmt(value);
    setAnim((s) => ({
      currentStr: newStr,
      prevStr: s.currentStr,
      dir: value > prev ? "up" : "down",
      epoch: s.epoch + 1,
    }));
    prevValueRef.current = value;
  }, [value]);

  const { currentStr, prevStr, dir, epoch } = anim;
  const chars = currentStr.split("");
  const prevChars = prevStr ? prevStr.split("") : null;

  return (
    <span className={clsx("font-mono tabular-nums inline-flex rounded-sm", className)}>
      {/* key={epoch} remounts this span on every price change, giving all children
          a fresh mount so CSS digit animations play from the start. */}
      <span key={epoch} className="inline-flex">
        {chars.map((char, i) => {
          const prevChar = prevChars?.[i];
          const isDigit = /\d/.test(char);
          const changed = prevChars !== null && isDigit && prevChar !== char;

          if (!changed || !dir) {
            return <span key={i}>{char}</span>;
          }

          // Wrap in an overflow:hidden clip so the rolling digit doesn't leak outside
          return (
            <span
              key={i}
              className="relative inline-block overflow-hidden"
              style={{ height: "1.2em", verticalAlign: "bottom" }}
            >
              <span
                className={dir === "up" ? "digit-flip-up" : "digit-flip-down"}
                style={{ display: "block" }}
              >
                {char}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
