"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { InlineSlider } from "@/components/motion/range-slider-inline";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { ChartData } from "@/features/observatory/ui/shared";
import { datasetUrl } from "@/features/formations/domain/explorer";
import type { CampaignSource } from "@/features/formations/domain/api-contract";
import type { QuizQuestion } from "../domain/quiz";

const format = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
export function Quiz({
  questions,
  source,
}: {
  questions: QuizQuestion[];
  source: CampaignSource;
}) {
  const [index, setIndex] = useState(0),
    [guess, setGuess] = useState(50),
    [revealed, setRevealed] = useState(false);
  const reduce = useReducedMotion();
  const question = questions[index];
  if (!question) return null;
  return (
    <main id="contenu" tabIndex={-1} className="mx-auto max-w-4xl py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">À votre avis ?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Parcoursup {source.campaign} · {questions.length} questions sur les
            données publiées
          </p>
        </div>
        <span className="rounded-full bg-subtle px-3 py-1.5 text-xs tabular-nums">
          {index + 1} / {questions.length}
        </span>
      </div>
      <section className="mt-10" aria-label="Question sur les données">
        <p className="text-xs text-muted-foreground">{question.population}</p>
        <h2 className="mt-3 max-w-3xl text-2xl leading-snug font-medium tracking-tight sm:text-3xl">
          {question.title}
        </h2>
        <div className="mt-8 max-w-xl">
          <InlineSlider
            label="Votre estimation"
            aria-label="Votre estimation en pourcentage"
            min={0}
            max={100}
            step={1}
            value={guess}
            onValueChange={setGuess}
            disabled={revealed}
            format={(value) => `${format(value)} %`}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            De 0 à 100 % · utilisez les flèches du clavier pour ajuster.
          </p>
        </div>
        {!revealed ? (
          <Button
            variant="secondary"
            className="mt-6 rounded-lg"
            onClick={() => setRevealed(true)}
          >
            Révéler les données
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            className="mt-8"
          >
            <div
              role="status"
              className="flex flex-wrap items-baseline gap-x-5 gap-y-2"
            >
              <p className="text-5xl font-medium tracking-tight tabular-nums">
                {format(question.answer)} %
              </p>
              <p className="text-sm text-muted-foreground">
                Votre estimation : {format(guess)} % · écart de{" "}
                {format(Math.abs(guess - question.answer))} points
              </p>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
              {question.explanation}
            </p>
            <div className="panel mt-6 p-4">
              <BarChart
                className="gradavia-chart h-64"
                data={question.values.map((value) => ({
                  label: value.label,
                  Effectif: value.count,
                }))}
                index="label"
                categories={["Effectif"]}
                colors={["charcoal"]}
                showLegend={false}
                valueFormatter={format}
                allowDecimals={false}
              />
              <ChartData
                title="Valeurs de la réponse"
                data={question.values}
                columns={[
                  { key: "label", header: "Population" },
                  { key: "count", header: "Effectif", align: "right" },
                ]}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="rounded-lg"
                onClick={() => {
                  setIndex((index + 1) % questions.length);
                  setRevealed(false);
                  setGuess(50);
                }}
              >
                {index + 1 === questions.length ? (
                  <>
                    <RotateCcw className="size-4" />
                    Recommencer
                  </>
                ) : (
                  <>
                    Question suivante
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
              <ButtonLink href={question.analysis} variant="ghost">
                Explorer la réponse
              </ButtonLink>
            </div>
          </motion.div>
        )}
      </section>
      <footer className="mt-10 text-xs leading-6 text-muted-foreground">
        <a
          className="underline underline-offset-4"
          href={datasetUrl(source.datasetId)}
          target="_blank"
          rel="noreferrer"
        >
          {source.provider} · {source.datasetId}
        </a>
        <p>{source.license} · Une seule campagne, hors apprentissage.</p>
        <p className="break-all">Version {source.releaseId}</p>
      </footer>
    </main>
  );
}
