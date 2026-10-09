"use client";

import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { ResponsiveContainer as RechartsContainer } from "recharts";

/** Hidden panels retain the last real chart size instead of collapsing to zero. */
export function ResponsiveContainer({
  children,
  className,
}: {
  children: ReactElement;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setSize((previous) =>
        previous?.width === width && previous?.height === height
          ? previous
          : { width, height },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div
      ref={host}
      className={className}
      style={{ width: "100%", height: "100%", minWidth: 0 }}
    >
      {size && (
        <RechartsContainer width={size.width} height={size.height}>
          {children}
        </RechartsContainer>
      )}
    </div>
  );
}
