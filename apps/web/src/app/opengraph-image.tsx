import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo-mark";

export const alt =
  "Gradavia — Les données publiques pour éclairer votre orientation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        background: "#f7f7f5",
        color: "#171717",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <LogoMark size={40} color="#171717" />
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -2 }}>
            gradavia
          </span>
        </div>
        <span style={{ fontSize: 20, color: "#606060" }}>
          L’observatoire de Parcoursup
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 72, letterSpacing: -4, fontWeight: 700 }}>
          Votre orientation,
        </span>
        <span style={{ fontSize: 72, letterSpacing: -4, color: "#646464" }}>
          les données en main.
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #d0d0d0",
          paddingTop: 28,
          fontSize: 22,
        }}
      >
        <span>Formations · Admissions · Comparaisons</span>
        <span>gradavia.com</span>
      </div>
    </div>,
    size,
  );
}
