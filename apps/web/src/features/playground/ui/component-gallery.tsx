"use client";

import { useState } from "react";
import { Button } from "@/components/motion/button/base";
import { LineChart } from "@/components/charts/tremor/components/LineChart/LineChart";

const sample = [
  { repere: "A", Exemple: 18 },
  { repere: "B", Exemple: 32 },
  { repere: "C", Exemple: 27 },
  { repere: "D", Exemple: 46 },
  { repere: "E", Exemple: 41 },
  { repere: "F", Exemple: 62 },
];

export function ComponentGallery() {
  const [activated, setActivated] = useState(false);

  return (
    <div className="mt-12 space-y-8">
      <section
        className="rounded-xl border border-border bg-surface p-6 sm:p-8"
        aria-labelledby="controls-title"
      >
        <h2 id="controls-title" className="text-lg font-medium">
          Contrôles et interactions
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          beUI · Motion · navigation clavier
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => setActivated(true)}>Tester le bouton</Button>
          <Button variant="outline" onClick={() => setActivated(false)}>
            Réinitialiser
          </Button>
          <Button variant="secondary" disabled>
            Indisponible
          </Button>
        </div>
        <p role="status" className="mt-4 min-h-5 text-sm text-muted-foreground">
          {activated ? "Interaction vérifiée." : "Prêt pour un test."}
        </p>
      </section>
      <section
        className="rounded-xl border border-border bg-surface p-6 sm:p-8"
        aria-labelledby="chart-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="chart-title" className="text-lg font-medium">
            Une série, six repères
          </h2>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Données fictives
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Exemple technique Tremor. Valeurs sans unité et sans lien avec
          Parcoursup.
        </p>
        <div className="orvio-chart mt-8" aria-hidden="true" inert>
          <LineChart
            className="h-64"
            data={sample}
            index="repere"
            categories={["Exemple"]}
            colors={["gray"]}
            showLegend={false}
            showTooltip={false}
            valueFormatter={(value) =>
              new Intl.NumberFormat("fr-FR").format(value)
            }
          />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-sm"
            aria-label="Données fictives du graphique"
          >
            <caption className="mb-3 text-left text-xs text-muted-foreground">
              Valeurs de l’exemple
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 font-medium">
                  Repère
                </th>
                {sample.map((row) => (
                  <th
                    scope="col"
                    key={row.repere}
                    className="px-2 py-2 text-right font-medium"
                  >
                    {row.repere}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th
                  scope="row"
                  className="py-3 font-normal text-muted-foreground"
                >
                  Valeur
                </th>
                {sample.map((row) => (
                  <td
                    key={row.repere}
                    className="px-2 py-3 text-right tabular-nums"
                  >
                    {row.Exemple}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
