"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { AtlasItem } from "@/features/atlas/domain/api-contract";
import {
  formatMeasure,
  measureLabels,
  measureValue,
  type AnalysisConfig,
} from "../domain/analysis";

export function Scatter({
  rows,
  config,
  selectedId,
  onSelect,
}: {
  rows: AtlasItem[];
  config: AnalysisConfig;
  selectedId: string | null;
  onSelect: (row: AtlasItem) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const positions = useRef<
    { row: AtlasItem; x: number; y: number; radius: number }[]
  >([]);
  const [hovered, setHovered] = useState<AtlasItem | null>(null);
  const { resolvedTheme } = useTheme();
  const points = useMemo(
    () =>
      rows
        .map((row) => ({
          row,
          x: measureValue(row, config.x),
          y: measureValue(row, config.y),
          size: measureValue(row, config.size),
        }))
        .filter(
          (point): point is typeof point & { x: number; y: number } =>
            point.x !== null && point.y !== null,
        ),
    [rows, config.x, config.y, config.size],
  );
  const maximum = useMemo(
    () => ({
      x: Math.max(1, ...points.map((point) => point.x)),
      y: Math.max(1, ...points.map((point) => point.y)),
      size: Math.max(1, ...points.map((point) => point.size ?? 0)),
    }),
    [points],
  );
  useEffect(() => {
    const node = canvas.current,
      holder = container.current;
    if (!node || !holder) return;
    const draw = () => {
      const width = holder.clientWidth,
        height = 420,
        ratio = window.devicePixelRatio || 1;
      node.width = width * ratio;
      node.height = height * ratio;
      const context = node.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      const left = width < 500 ? 52 : 72,
        right = 22,
        top = 25,
        bottom = 65,
        plotWidth = Math.max(1, width - left - right),
        plotHeight = height - top - bottom;
      const color = resolvedTheme === "dark" ? "#e5e5e5" : "#292929";
      const grid = resolvedTheme === "dark" ? "#333333" : "#e8e8e8";
      context.font = "11px system-ui";
      for (let tick = 0; tick <= 4; tick++) {
        const x = left + (tick / 4) * plotWidth,
          y = top + plotHeight - (tick / 4) * plotHeight;
        context.strokeStyle = grid;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
        context.fillStyle = color;
        context.textAlign = "right";
        context.fillText(
          new Intl.NumberFormat("fr", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format((maximum.y * tick) / 4),
          left - 10,
          y + 4,
        );
        context.textAlign = "center";
        context.fillText(
          new Intl.NumberFormat("fr", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format((maximum.x * tick) / 4),
          x,
          top + plotHeight + 25,
        );
      }
      context.fillStyle = color;
      context.textAlign = "left";
      context.fillText(measureLabels[config.y], left, 13);
      context.textAlign = "center";
      context.fillText(
        measureLabels[config.x],
        left + plotWidth / 2,
        height - 10,
      );
      positions.current = points.map((point) => ({
        row: point.row,
        x: left + (point.x / maximum.x) * plotWidth,
        y: top + plotHeight - (point.y / maximum.y) * plotHeight,
        radius:
          point.size === null
            ? 2.5
            : 2.5 + Math.sqrt(point.size / maximum.size) * 11,
      }));
      for (const point of positions.current) {
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, 2 * Math.PI);
        context.fillStyle = color;
        context.globalAlpha = 0.26;
        context.fill();
        if (point.row.id === selectedId || point.row.id === hovered?.id) {
          context.globalAlpha = 1;
          context.lineWidth = 2;
          context.strokeStyle = color;
          context.stroke();
        }
      }
      context.globalAlpha = 1;
    };
    const observer = new ResizeObserver(draw);
    observer.observe(holder);
    draw();
    return () => observer.disconnect();
  }, [
    points,
    maximum,
    config.x,
    config.y,
    selectedId,
    hovered?.id,
    resolvedTheme,
  ]);
  const nearest = (x: number, y: number) => {
    let closest: AtlasItem | null = null,
      distance = Infinity;
    for (const point of positions.current) {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < Math.max(8, point.radius) && d < distance) {
        closest = point.row;
        distance = d;
      }
    }
    return closest;
  };
  return (
    <div ref={container} className="relative min-w-0">
      <canvas
        ref={canvas}
        className="h-[420px] w-full cursor-crosshair"
        role="img"
        aria-label={`Nuage de ${points.length} formations : ${measureLabels[config.x]} et ${measureLabels[config.y]}. Les valeurs et les liens sont accessibles dans le tableau des formations.`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const row = nearest(
            event.clientX - rect.left,
            event.clientY - rect.top,
          );
          if (row?.id !== hovered?.id) setHovered(row);
        }}
        onPointerLeave={() => setHovered(null)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const row = nearest(
            event.clientX - rect.left,
            event.clientY - rect.top,
          );
          if (row) onSelect(row);
        }}
      />
      {hovered && (
        <div
          className="pointer-events-none absolute top-8 right-4 left-16 max-w-72 rounded-lg border border-border bg-background/95 p-3 text-xs shadow-lg"
          aria-hidden="true"
        >
          <p className="font-medium">{hovered.title}</p>
          <p className="mt-1 text-muted-foreground">{hovered.establishment}</p>
          <p className="mt-3">
            {measureLabels[config.x]} :{" "}
            {formatMeasure(measureValue(hovered, config.x), config.x)} ·{" "}
            {measureLabels[config.y]} :{" "}
            {formatMeasure(measureValue(hovered, config.y), config.y)}
          </p>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {points.length.toLocaleString("fr")} points ·{" "}
        {rows.length - points.length} lignes sans valeur sur l’un des axes.
        Taille : {measureLabels[config.size].toLocaleLowerCase("fr")}. Taille
        minimale lorsque la valeur est absente.
      </p>
    </div>
  );
}
