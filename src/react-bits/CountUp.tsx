import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type CountUpProps = {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
};

export function CountUp({
  to,
  decimals = 0,
  suffix = "",
  duration = 1.35,
  delay = 0,
  className = ""
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const value = useMotionValue(reduceMotion ? to : 0);
  const [display, setDisplay] = useState(
    `${(reduceMotion ? to : 0).toFixed(decimals)}${suffix}`
  );

  useEffect(() => {
    return value.on("change", (latest) => {
      setDisplay(`${latest.toFixed(decimals)}${suffix}`);
    });
  }, [decimals, suffix, value]);

  useEffect(() => {
    if (reduceMotion) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1]
    });
    return () => controls.stop();
  }, [delay, duration, reduceMotion, to, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
