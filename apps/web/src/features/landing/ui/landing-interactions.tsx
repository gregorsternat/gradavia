"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import styles from "./landing.module.css";

export function LandingReveal({
  children,
  className,
  delay = 0,
  distance = 28,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  as?: "div" | "span";
}) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null);
  const ready = useClientReady();
  const reduce = useReducedMotion();
  const inView = useInView(ref, {
    once: true,
    amount: 0.12,
    margin: "0px 0px -32px 0px",
  });
  const [focused, setFocused] = useState(false);
  const immediate = !ready || reduce || focused;
  const visible = immediate || inView;
  const Element = as === "span" ? motion.span : motion.div;

  return (
    <Element
      ref={ref}
      data-landing-reveal=""
      data-reveal-focused={focused ? "" : undefined}
      initial={false}
      // Server-rendered content stays readable until hydration enables motion.
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{
        duration: immediate || !visible ? 0 : 0.8,
        delay: immediate || !visible ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onKeyDownCapture={() => setFocused(true)}
      className={`${styles.reveal} ${className ?? ""}`}
    >
      {children}
    </Element>
  );
}

export function LandingSearch() {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[0_8px_40px_-20px_#00000020] sm:p-8">
      <form
        action="/formations"
        method="get"
        role="search"
        aria-label="Trouver une formation"
      >
        <label
          htmlFor="landing-search"
          className="mb-4 block text-sm font-medium"
        >
          Qu’aimeriez-vous étudier ?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="landing-search"
            name="q"
            type="search"
            maxLength={120}
            placeholder="Une formation, une ville…"
            leftIcon={<Search className="size-4" aria-hidden="true" />}
            className="min-w-0 flex-1"
            classNames={{ input: "h-12 text-sm", field: "rounded-xl" }}
          />
          <Button
            type="submit"
            className="h-12 gap-2 rounded-xl px-5"
            pressScale={0.98}
          >
            Rechercher <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 text-xs">
        <span className="text-muted-foreground">Par exemple</span>
        {["Informatique", "Architecture", "Droit"].map((query) => (
          <Link
            key={query}
            href={`/formations?q=${encodeURIComponent(query)}`}
            className="decoration-border underline-offset-4 hover:underline"
          >
            {query}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function LandingQuestions() {
  return (
    <BouncyAccordion
      className={styles.questions}
      classNames={{
        trigger: "px-5 py-5 sm:px-6",
        title:
          "overflow-visible whitespace-normal text-clip text-sm font-medium tracking-[-0.015em]",
        description: "text-sm leading-7 text-muted-foreground",
      }}
      items={[
        {
          id: "sources",
          title: "D’où viennent les données ?",
          description: (
            <>
              Des jeux de données publics du ministère chargé de l’Enseignement
              supérieur. Chaque indicateur garde sa campagne, sa définition et
              sa source. Gradavia est un observatoire indépendant du service
              Parcoursup.
              <Link
                href="/sources"
                className="mt-3 block font-medium text-foreground underline underline-offset-4"
              >
                Consulter les sources
              </Link>
            </>
          ),
        },
        {
          id: "rates",
          title: "Le taux d’accès indique-t-il mes chances ?",
          description:
            "Il décrit une campagne passée, pas votre probabilité personnelle d’admission. Le nombre de places, les profils et le périmètre de chaque formation apportent le contexte nécessaire à sa lecture.",
        },
        {
          id: "favorites",
          title: "Faut-il un compte pour garder une sélection ?",
          description:
            "Non. Vos favoris sont enregistrés dans ce navigateur, sur cet appareil. Vous pouvez comparer jusqu’à quatre formations d’une même campagne. Effacer les données du navigateur efface aussi vos favoris.",
        },
      ]}
    />
  );
}
