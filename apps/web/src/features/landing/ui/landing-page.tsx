import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  GitCompareArrows,
  GraduationCap,
  Heart,
  MapPin,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { ThemeSelect } from "@/components/theme-select";
import { ButtonLink } from "@/components/motion/button/base";
import {
  LandingQuestions,
  LandingReveal,
  LandingSearch,
} from "./landing-interactions";
import styles from "./landing.module.css";

const entries = [
  {
    href: "/specialites",
    icon: GraduationCap,
    title: "À partir de vos spécialités",
    description:
      "Découvrez les formations rejointes par les bacheliers qui ont suivi votre doublette.",
    action: "Explorer les spécialités",
  },
  {
    href: "/territoires",
    icon: MapPin,
    title: "À l’échelle d’un territoire",
    description:
      "Repérez l’offre de formation et les capacités d’accueil dans chaque région.",
    action: "Explorer les territoires",
  },
];

export function LandingPage({ preview }: { preview: ReactNode }) {
  return (
    <div className={styles.landing}>
      <header className={styles.header}>
        <div
          className={`${styles.container} flex h-20 items-center justify-between gap-5`}
        >
          <Wordmark />
          <nav
            aria-label="Navigation d’accueil"
            className="flex items-center gap-7 text-[13px]"
          >
            <Link
              href="#explorer"
              className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              Découvrir
            </Link>
            <Link
              href="/sources"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Données & méthode
            </Link>
            <ButtonLink
              href="/observatoire"
              variant="outline"
              className="h-10 gap-2 rounded-lg px-4 text-xs"
              pressScale={0.98}
            >
              Ouvrir l’observatoire{" "}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </ButtonLink>
          </nav>
        </div>
      </header>
      <main id="contenu" tabIndex={-1}>
        <section
          aria-labelledby="landing-title"
          className={`${styles.container} ${styles.hero}`}
        >
          <LandingReveal distance={16}>
            <p className={styles.kicker}>L’observatoire de Parcoursup</p>
          </LandingReveal>
          <h1 id="landing-title" className={styles.heroTitle}>
            <LandingReveal
              as="span"
              className="block"
              delay={0.08}
              distance={36}
            >
              Votre orientation,
            </LandingReveal>
            <LandingReveal
              as="span"
              className="block text-muted-foreground"
              delay={0.18}
              distance={36}
            >
              les données en main.
            </LandingReveal>
          </h1>
          <LandingReveal delay={0.28} distance={22}>
            <p className={styles.heroCopy}>
              Explorez les formations, comparez les admissions.
              <br className="hidden sm:block" /> Les données publiques pour
              éclairer vos choix.
            </p>
          </LandingReveal>
          <LandingReveal
            delay={0.38}
            distance={20}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-9 sm:gap-5"
          >
            <ButtonLink
              href="/formations"
              size="lg"
              className="h-12 gap-3 rounded-xl px-6 text-sm"
              pressScale={0.98}
            >
              Explorer les formations{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <Link
              href="#apercu"
              className="inline-flex min-h-12 items-center gap-2 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Voir l’aperçu{" "}
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </Link>
          </LandingReveal>
          <LandingReveal delay={0.46} distance={12}>
            <p className="mt-5 text-xs text-muted-foreground">
              En accès libre. Sans inscription.
            </p>
          </LandingReveal>
        </section>
        <div
          id="apercu"
          className={`${styles.container} ${styles.previewWrap}`}
        >
          <LandingReveal distance={40} delay={0.12}>
            <div className={styles.previewFrame}>{preview}</div>
          </LandingReveal>
        </div>
        <section
          aria-labelledby="explorer-title"
          className={`${styles.container} ${styles.section}`}
        >
          <div id="explorer" className={styles.searchSection}>
            <LandingReveal>
              <h2 id="explorer-title" className={styles.sectionTitle}>
                Une formation en tête ?<br />
                Regardez de plus près.
              </h2>
              <p className={`${styles.bodyCopy} mt-5 max-w-sm`}>
                Places proposées, profils des admis, taux d’accès : retrouvez
                les indicateurs derrière chaque formation.
              </p>
            </LandingReveal>
            <LandingReveal delay={0.14}>
              <LandingSearch />
            </LandingReveal>
          </div>
          <div className="mt-8 grid gap-x-12 gap-y-7 px-1 sm:grid-cols-2 sm:px-2 lg:mt-10 lg:gap-x-20">
            <LandingReveal>
              <Link href="/comparer" className={`${styles.utilityLink} group`}>
                <GitCompareArrows
                  className="mt-0.5 size-5 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-medium">
                    Vos options, côte à côte.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Jusqu’à quatre formations d’une même campagne, sur les mêmes
                    indicateurs.
                  </p>
                </div>
                <ArrowUpRight className={styles.linkArrow} aria-hidden="true" />
              </Link>
            </LandingReveal>
            <LandingReveal delay={0.12}>
              <Link href="/favoris" className={`${styles.utilityLink} group`}>
                <Heart
                  className="mt-0.5 size-5 shrink-0"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-medium">
                    Une sélection à retrouver.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Gardez les formations qui vous intéressent dans les favoris
                    de votre navigateur.
                  </p>
                </div>
                <ArrowUpRight className={styles.linkArrow} aria-hidden="true" />
              </Link>
            </LandingReveal>
          </div>
        </section>
        <section
          aria-labelledby="directions-title"
          className={styles.container}
        >
          <LandingReveal>
            <div className="mb-9 flex flex-wrap items-end justify-between gap-5 sm:mb-11">
              <h2 id="directions-title" className={styles.sectionTitle}>
                D’autres points de départ.
              </h2>
            </div>
          </LandingReveal>
          <div className="grid gap-5 md:grid-cols-2">
            {entries.map(
              ({ href, icon: Icon, title, description, action }, index) => (
                <LandingReveal key={href} delay={index * 0.14}>
                  <Link
                    href={href}
                    className={`${styles.entryCard} group h-full`}
                  >
                    <Icon
                      className="mb-9 size-7"
                      strokeWidth={1.25}
                      aria-hidden="true"
                    />
                    <h3 className="text-xl font-medium tracking-[-0.035em]">
                      {title}
                    </h3>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                      {description}
                    </p>
                    <span className="mt-8 flex items-center justify-between gap-3 text-xs font-medium">
                      {action}
                      <ArrowUpRight
                        className={styles.linkArrow}
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </LandingReveal>
              ),
            )}
          </div>
        </section>
        <section
          aria-labelledby="sources-title"
          className={`${styles.container} ${styles.section}`}
        >
          <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-24">
            <LandingReveal>
              <BookOpen
                className="mb-6 size-6 text-muted-foreground"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h2 id="sources-title" className={styles.sectionTitle}>
                Des chiffres que
                <br />
                vous pouvez vérifier.
              </h2>
              <p className={`${styles.bodyCopy} mt-5 max-w-sm`}>
                Derrière chaque indicateur, une source et une définition. Les
                limites des données restent visibles, pour comprendre ce
                qu’elles disent.
              </p>
              <Link
                href="/sources"
                className="mt-7 inline-flex items-center gap-3 text-sm font-medium"
              >
                Lire la méthode{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </LandingReveal>
            <LandingReveal delay={0.14} className="min-w-0 lg:pt-2">
              <LandingQuestions />
            </LandingReveal>
          </div>
        </section>
        <section aria-labelledby="start-title" className={styles.closing}>
          <div
            className={`${styles.container} flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center`}
          >
            <LandingReveal distance={32}>
              <h2 id="start-title" className={styles.closingTitle}>
                À vous d’explorer.
              </h2>
            </LandingReveal>
            <LandingReveal delay={0.14}>
              <ButtonLink
                href="/formations"
                size="lg"
                className="h-13 gap-4 rounded-xl bg-white px-6 text-sm text-[#202124] hover:bg-white/90"
                pressScale={0.98}
              >
                Trouver une formation{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </LandingReveal>
          </div>
        </section>
      </main>
      <footer className={`${styles.container} ${styles.footer}`}>
        <div>
          <Wordmark />
          <p className="mt-3 text-xs text-muted-foreground">
            L’observatoire de l’orientation.
          </p>
        </div>
        <nav
          aria-label="Liens utiles"
          className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground"
        >
          <Link href="/observatoire" className="hover:text-foreground">
            Observatoire
          </Link>
          <Link href="/formations" className="hover:text-foreground">
            Formations
          </Link>
          <Link href="/sources" className="hover:text-foreground">
            Données & méthode
          </Link>
        </nav>
        <ThemeSelect />
      </footer>
    </div>
  );
}
