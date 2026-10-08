"use client";
import dynamic from "next/dynamic";
export const FormationMap = dynamic(
  () => import("./leaflet-map").then((module) => module.FormationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[440px] rounded-xl bg-subtle sm:h-[600px]"
        aria-label="Chargement de la carte"
      />
    ),
  },
);
