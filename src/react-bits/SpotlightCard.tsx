import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useRef } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  as?: "div" | "section" | "article";
};

type SpotlightStyle = CSSProperties & {
  "--spotlight-x": string;
  "--spotlight-y": string;
  "--spotlight-color": string;
};

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(194, 58, 53, 0.075)",
  as = "div"
}: SpotlightCardProps) {
  const ref = useRef<HTMLElement | null>(null);

  const move = (event: PointerEvent<HTMLElement>) => {
    const element = ref.current;
    if (!element || event.pointerType !== "mouse") return;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    element.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  };

  const style: SpotlightStyle = {
    "--spotlight-x": "50%",
    "--spotlight-y": "50%",
    "--spotlight-color": spotlightColor
  };

  const content = <div className="spotlight-content">{children}</div>;
  const assignRef = (node: HTMLElement | null) => {
    ref.current = node;
  };

  if (as === "section") {
    return (
      <section
        ref={assignRef}
        className={`spotlight-card ${className}`}
        style={style}
        onPointerMove={move}
      >
        {content}
      </section>
    );
  }
  if (as === "article") {
    return (
      <article
        ref={assignRef}
        className={`spotlight-card ${className}`}
        style={style}
        onPointerMove={move}
      >
        {content}
      </article>
    );
  }
  return (
    <div
      ref={assignRef}
      className={`spotlight-card ${className}`}
      style={style}
      onPointerMove={move}
    >
      {content}
    </div>
  );
}
