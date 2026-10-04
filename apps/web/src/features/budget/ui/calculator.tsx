"use client";

import { useState, useSyncExternalStore } from "react";
import { Plus, Printer, Save, X } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { SelectField } from "@/features/formations/ui/shared";
import {
  budgetFields,
  budgetTotals,
  newScenario,
  readBudgets,
  type BudgetScenario,
} from "../domain/scenarios";

const key = "gradavia.budgets.v1";
const defaults = [newScenario("first"), newScenario("second")];
const euro = (value: number) =>
  value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
const style = {
  field: "rounded-lg",
  label: "text-xs font-normal",
  input: "text-sm",
};
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("gradavia-budget", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("gradavia-budget", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function BudgetCalculator() {
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  const [draft, setDraft] = useState<BudgetScenario[] | null>(null);
  const [notice, setNotice] = useState("");
  const scenarios = draft ?? readBudgets(stored) ?? defaults;
  const update = (id: string, patch: Partial<BudgetScenario>) => {
    setDraft(
      scenarios.map((scenario) =>
        scenario.id === id ? { ...scenario, ...patch } : scenario,
      ),
    );
    setNotice("");
  };
  const results = scenarios.map((scenario, index) => ({
    scenario,
    name: scenario.name || scenario.city || `Scénario ${index + 1}`,
    totals: budgetTotals(scenario),
  }));
  return (
    <main id="contenu" className="budget-print min-w-0 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Préparer son budget
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Comparez vos propres estimations. Aucun prix moyen par ville n’est
            présumé.
          </p>
        </div>
        <div className="budget-controls flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              try {
                const payload = JSON.stringify({ version: 1, scenarios });
                if (!readBudgets(payload)) {
                  setNotice(
                    "Vérifiez les montants : deux décimales maximum, sans valeur négative.",
                  );
                  return;
                }
                localStorage.setItem(key, payload);
                window.dispatchEvent(new Event("gradavia-budget"));
                setNotice("Scénarios enregistrés sur cet appareil.");
              } catch {
                setNotice(
                  "Enregistrement indisponible. Les scénarios restent accessibles dans cet onglet.",
                );
              }
            }}
          >
            <Save className="size-4" /> Enregistrer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimer
          </Button>
        </div>
      </div>
      {notice && (
        <p role="status" className="mb-5 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {scenarios.map((scenario, index) => (
          <section
            key={scenario.id}
            aria-label={`Scénario ${index + 1}`}
            className="rounded-xl border border-border bg-surface p-5 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Scénario {index + 1}</h2>
              {scenarios.length > 1 && (
                <Button
                  className="budget-controls"
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer le scénario ${index + 1}`}
                  onClick={() =>
                    setDraft(
                      scenarios.filter((item) => item.id !== scenario.id),
                    )
                  }
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nom du scénario"
                maxLength={80}
                value={scenario.name}
                onChange={(name) => update(scenario.id, { name })}
                placeholder="Licence près de chez moi"
                classNames={style}
              />
              <Input
                label="Ville"
                maxLength={80}
                value={scenario.city}
                onChange={(city) => update(scenario.id, { city })}
                classNames={style}
              />
              <div>
                <p className="mb-2 text-xs">Durée des études</p>
                <SelectField
                  label={`Durée du scénario ${index + 1}`}
                  value={String(scenario.years)}
                  onChange={(value) =>
                    update(scenario.id, { years: Number(value) })
                  }
                  options={Array.from({ length: 8 }, (_, i) => ({
                    value: String(i + 1),
                    label: `${i + 1} an${i ? "s" : ""}`,
                  }))}
                />
              </div>
              <div>
                <p className="mb-2 text-xs">Mois de dépenses par an</p>
                <SelectField
                  label={`Mois payés du scénario ${index + 1}`}
                  value={String(scenario.months)}
                  onChange={(value) =>
                    update(scenario.id, { months: Number(value) })
                  }
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i + 1),
                    label: `${i + 1} mois`,
                  }))}
                />
              </div>
              {budgetFields.map(({ key: field, label }) => (
                <Input
                  key={field}
                  label={`${label} (€)`}
                  inputMode="decimal"
                  value={scenario[field]}
                  onChange={(value) => {
                    const clean = value.replace(",", ".");
                    if (clean === "" || /^\d{1,7}(\.\d{0,2})?$/.test(clean))
                      update(scenario.id, { [field]: clean });
                  }}
                  placeholder="À renseigner, 0 si aucun"
                  classNames={style}
                />
              ))}
            </div>
            <div className="mt-6 rounded-lg bg-subtle p-4">
              <p className="text-xs text-muted-foreground">
                Total estimé sur {scenario.years} an
                {scenario.years > 1 ? "s" : ""}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {results[index]?.totals
                  ? euro(results[index]!.totals!.total)
                  : "À compléter"}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {results[index]?.totals
                  ? `${euro(results[index]!.totals!.annual)} par an, puis ${euro(Number(scenario.setup))} d’installation une seule fois.`
                  : "Renseignez chaque poste pour calculer le total."}
              </p>
            </div>
          </section>
        ))}
      </div>
      {scenarios.length < 4 && (
        <Button
          variant="secondary"
          className="budget-controls mt-5"
          onClick={() =>
            setDraft([...scenarios, newScenario(crypto.randomUUID())])
          }
        >
          <Plus className="size-4" /> Ajouter un scénario
        </Button>
      )}
      {results.filter((result) => result.totals).length > 1 && (
        <section className="mt-7 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Coût sur la durée choisie</h2>
          <BarChart
            className="gradavia-chart mt-5 h-64"
            data={results.map((result) => ({
              Scénario: `${result.name} · ${result.scenario.years} ans`,
              "Coût total": result.totals?.total ?? null,
            }))}
            index="Scénario"
            categories={["Coût total"]}
            colors={["charcoal"]}
            showLegend={false}
            valueFormatter={euro}
          />
          <dl className="mt-4 space-y-2">
            {results.map((result) => (
              <div
                key={result.scenario.id}
                className="flex justify-between gap-3 text-xs"
              >
                <dt>
                  {result.name} · {result.scenario.years} ans
                </dt>
                <dd className="tabular-nums">
                  {result.totals ? euro(result.totals.total) : "À compléter"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <p className="mt-6 max-w-3xl text-xs leading-5 text-muted-foreground">
        Hypothèses saisies sur cet appareil, en euros constants : dépenses
        mensuelles × mois payés × années, frais de formation chaque année,
        installation une fois. Les aides, revenus, variations de prix et
        remboursements ne sont pas déduits. Les durées de deux scénarios peuvent
        différer.
      </p>
      <style>{`@media print { body * { visibility: hidden; } .budget-print, .budget-print * { visibility: visible; } .budget-print { position: absolute; top: 0; left: 0; width: 100%; padding: 16px; } .budget-controls, .budget-controls * { display: none !important; } .budget-print section { break-inside: avoid; } }`}</style>
    </main>
  );
}
