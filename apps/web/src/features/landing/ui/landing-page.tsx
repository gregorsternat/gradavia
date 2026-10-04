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
  },
  {
    href: "/territoires",
    icon: MapPin,
    title: "À l’échelle d’un territoire",
    description:
      "Repérez l’offre de formation et les capacités d’accueil dans chaque région.",
  },
  {
    href: "/comparer",
    icon: GitCompareArrows,
    title: "Vos options, côte à côte.",
    description:
      "Jusqu’à quatre formations d’une même campagne, sur les mêmes indicateurs.",
  },
  {
    href: "/favoris",
    icon: Heart,
    title: "Une sélection à retrouver.",
    description:
      "Gardez les formations qui vous intéressent dans les favoris de votre navigateur.",
  },
];

export function LandingPage({ preview }: { preview: ReactNode }) {
  return (
    <div className={styles.landing}>
      <header className={styles.header}>
        <div
          className={`${styles.container} ${styles.headerInner} flex items-center justify-between gap-5`}
        >
          <Wordmark />
          <nav
            aria-label="Navigation d’accueil"
            className="flex items-center gap-7 text-[13px]"
          >
            <a
              href="#explorer"
              className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              Découvrir
            </a>
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
          className={`${styles.container} ${styles.section} ${styles.hero}`}
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
            <a
              href="#apercu"
              className="inline-flex min-h-12 items-center gap-2 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Voir l’aperçu{" "}
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </a>
          </LandingReveal>
          <LandingReveal delay={0.46} distance={12}>
            <p className="mt-5 text-xs text-muted-foreground">
              En accès libre. Sans inscription.
            </p>
          </LandingReveal>
        </section>
        <div
          id="apercu"
          tabIndex={-1}
          className={`${styles.container} ${styles.section}`}
        >
          <LandingReveal distance={40} delay={0.12}>
            <div className={styles.previewFrame}>{preview}</div>
          </LandingReveal>
        </div>
        <section
          id="explorer"
          tabIndex={-1}
          aria-labelledby="explorer-title"
          className={`${styles.container} ${styles.section}`}
        >
          <div className={styles.searchSection}>
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
          <div className={styles.entryGrid}>
            {entries.map(({ href, icon: Icon, title, description }, index) => (
              <LandingReveal key={href} delay={(index % 2) * 0.12}>
                <Link
                  href={href}
                  className={`${styles.entryCard} group h-full`}
                >
                  <Icon
                    className="mt-0.5 size-5 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <ArrowUpRight
                    className={styles.linkArrow}
                    aria-hidden="true"
                  />
                </Link>
              </LandingReveal>
            ))}
          </div>
        </section>
        <section
          aria-labelledby="sources-title"
          className={`${styles.container} ${styles.section} ${styles.conclusion}`}
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
          <div className={styles.closing}>
            <LandingReveal distance={32}>
              <h3 className={styles.closingTitle}>À vous d’explorer.</h3>
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
        <Wordmark />
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
