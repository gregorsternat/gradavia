"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePanelActive } from "@/features/workspace/ui/navigation";
import { Button } from "@/components/motion/button/base";
import type { AtlasItem } from "../domain/api-contract";
import { hasCoordinates, type GeoBounds } from "../domain/exploration";

export function FormationMap({
  items,
  selectedId,
  onSelect,
  onBounds,
  center,
  radius,
}: {
  items: AtlasItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onBounds: (bounds: GeoBounds) => void;
  center?: { latitude: number; longitude: number };
  radius: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<{
    map: Leaflet.Map;
    library: typeof Leaflet;
    layer: Leaflet.LayerGroup;
  } | null>(null);
  const handlers = useRef({ onSelect, onBounds });
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();
  const active = usePanelActive();
  useEffect(() => {
    const map = instance.current?.map;
    if (!map) return;
    if (active) map.invalidateSize({ animate: false });
    else map.stop();
  }, [active, ready]);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    handlers.current = { onSelect, onBounds };
  }, [onSelect, onBounds]);
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    void Promise.resolve(Leaflet)
      .then((L) => {
        if (cancelled || !element.current) return;
        const map = L.map(element.current, {
          preferCanvas: true,
          zoomControl: false,
          scrollWheelZoom: false,
          zoomAnimation: !reduce,
          fadeAnimation: !reduce,
          markerZoomAnimation: !reduce,
          inertia: !reduce,
        }).setView([46.6, 2.5], 5);
        L.control
          .zoom({ zoomInTitle: "Zoom avant", zoomOutTitle: "Zoom arrière" })
          .addTo(map);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);
        instance.current = {
          map,
          library: L,
          layer: L.layerGroup().addTo(map),
        };
        const update = () => {
          const bounds = map.getBounds();
          handlers.current.onBounds({
            south: bounds.getSouth(),
            north: bounds.getNorth(),
            west: bounds.getWest(),
            east: bounds.getEast(),
          });
        };
        map.on("moveend", update);
        observer = new ResizeObserver(() => {
          if (element.current?.clientWidth && element.current.clientHeight)
            map.invalidateSize({ animate: false });
        });
        observer.observe(element.current);
        setReady((generation) => generation + 1);
        update();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      instance.current?.map.remove();
      instance.current = null;
    };
  }, [reduce]);
  useEffect(() => {
    const current = instance.current;
    if (!current || !ready) return;
    const { library: L, layer } = current;
    layer.clearLayers();
    for (const row of items)
      if (hasCoordinates(row)) {
        const marker = L.circleMarker([row.latitude, row.longitude], {
          radius: row.id === selectedId ? 8 : 4,
          color:
            row.id === selectedId
              ? resolvedTheme === "dark"
                ? "#171717"
                : "#fff"
              : resolvedTheme === "dark"
                ? "#e5e5e5"
                : "#171717",
          weight: row.id === selectedId ? 2 : 1,
          fillColor: resolvedTheme === "dark" ? "#e5e5e5" : "#171717",
          fillOpacity: row.id === selectedId ? 1 : 0.65,
        });
        const label = document.createElement("span");
        label.textContent = `${row.title} · ${row.city ?? "Ville non renseignée"}`;
        marker.bindTooltip(label, { direction: "top" });
        marker.on("click", () => handlers.current.onSelect(row.id));
        layer.addLayer(marker);
      }
    if (center) {
      layer.addLayer(
        L.circle([center.latitude, center.longitude], {
          radius: radius * 1000,
          color: "#525252",
          weight: 1,
          dashArray: "5 5",
          fillOpacity: 0.04,
          interactive: false,
        }),
      );
    }
  }, [items, selectedId, ready, center, radius, resolvedTheme]);
  useEffect(() => {
    if (!instance.current || !ready) return;
    if (center)
      instance.current.map.fitBounds(
        instance.current.library
          .latLng(center.latitude, center.longitude)
          .toBounds(radius * 2000),
        { animate: false, padding: [24, 24], maxZoom: 13 },
      );
  }, [center, radius, ready]);
  const selected = items.find(
    (row) => row.id === selectedId && hasCoordinates(row),
  );
  const latitude = selected?.latitude;
  const longitude = selected?.longitude;
  useEffect(() => {
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      instance.current
    )
      instance.current.map.panTo([latitude, longitude], { animate: !reduce });
    // Recreated item arrays on tab activation must not recenter a panned map.
  }, [selectedId, latitude, longitude, ready, reduce]);
  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-border bg-subtle">
      <div
        ref={element}
        role="region"
        aria-label="Carte des formations. Flèches pour déplacer, plus et moins pour zoomer. Les mêmes formations sont accessibles dans la liste."
        className="gradavia-map h-[440px] w-full text-black sm:h-[600px]"
      />
      {ready > 0 && items.some(hasCoordinates) && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-3 right-3 z-[800] bg-surface shadow-sm"
          onClick={() => {
            const current = instance.current;
            if (!current) return;
            const points = items
              .filter(hasCoordinates)
              .map((row) => [row.latitude, row.longitude] as [number, number]);
            current.map.fitBounds(current.library.latLngBounds(points), {
              padding: [32, 32],
              maxZoom: 13,
              animate: !reduce,
            });
          }}
        >
          Cadrer les résultats
        </Button>
      )}
      {!ready && (
        <p
          role="status"
          className="absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground"
        >
          {failed
            ? "La carte n’a pas pu être chargée. La liste reste disponible."
            : "Chargement de la carte…"}
        </p>
      )}
    </div>
  );
}
