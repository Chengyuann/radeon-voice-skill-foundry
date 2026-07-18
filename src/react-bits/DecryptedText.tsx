import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";

type DecryptedTextProps = {
  text: string;
  className?: string;
  speed?: number;
};

const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function DecryptedText({
  text,
  className = "",
  speed = 24
}: DecryptedTextProps) {
  const reduceMotion = useReducedMotion();
  const [resolved, setResolved] = useState(reduceMotion ? text.length : 0);
  const seed = useMemo(
    () => Array.from(text, (_, index) => (index * 17 + text.length * 11) % characters.length),
    [text]
  );

  useEffect(() => {
    if (reduceMotion) {
      setResolved(text.length);
      return;
    }
    setResolved(0);
    const timer = window.setInterval(() => {
      setResolved((current) => {
        if (current >= text.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [reduceMotion, speed, text]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">
        {Array.from(text, (character, index) =>
          character === " " || index < resolved
            ? character
            : characters[seed[index]]
        ).join("")}
      </span>
    </span>
  );
}
