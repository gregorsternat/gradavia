"use client";
import { MapSkeleton } from "./loading";
import dynamic from "next/dynamic";
export const FormationMap = dynamic(
  () => import("./leaflet-map").then((module) => module.FormationMap),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);
