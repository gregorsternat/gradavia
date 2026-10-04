"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Compass,
  Database,
  GitCompareArrows,
  Heart,
  Map,
  PanelLeft,
  Search,
  GraduationCap,
  Telescope,
  X,
} from "lucide-react";
import {
  AnimatedSidebarProvider,
  AnimatedSidebar,
  AnimatedSidebarHeader,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuItem,
  AnimatedSidebarMenuButton,
  AnimatedSidebarTrigger,
  AnimatedSidebarClose,
  useAnimatedSidebar,
} from "@/components/motion/animated-sidebar";
import { CommandPalette } from "@/components/motion/command-palette";
import { Button } from "@/components/motion/button/base";
import { ThemeSelect } from "@/components/theme-select";
import { Wordmark } from "@/components/wordmark";
import { useFormationSelection } from "@/features/formations/ui/selection-provider";

const destinations = [
  {
    href: "/observatoire",
    label: "Vue d’ensemble",
    icon: ChartNoAxesCombined,
    keywords: ["accueil", "observatoire", "statistiques"],
  },
  {
    href: "/formations",
    label: "Formations",
    icon: Compass,
    keywords: ["rechercher", "parcoursup", "explorer"],
  },
  {
    href: "/specialites",
    label: "Spécialités du bac",
    icon: GraduationCap,
    keywords: ["lycée", "doublette", "bac général", "profil"],
  },
  {
    href: "/territoires",
    label: "Territoires",
    icon: Map,
    keywords: ["région", "géographie", "villes"],
  },
  {
    href: "/comparer",
    label: "Comparer",
    icon: GitCompareArrows,
    keywords: ["comparaison", "sélection"],
  },
  {
    href: "/favoris",
    label: "Mes favoris",
    icon: Heart,
    keywords: ["enregistrées", "sauvegarder"],
  },
];

function ShellContents({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { favorites, comparison } = useFormationSelection();
  const { open, isMobile, setOpenMobile } = useAnimatedSidebar();
  const [commandOpen, setCommandOpen] = useState(false);
  const changeCommandOpen = useCallback(
    (next: boolean) => {
      if (next && isMobile) setOpenMobile(false);
      setCommandOpen(next);
    },
    [isMobile, setOpenMobile],
  );
  const title = pathname.startsWith("/formations/")
    ? "Fiche formation"
    : ([
        ...destinations,
        { href: "/sources", label: "Données & méthode" },
        { href: "/dev/ui", label: "Composants" },
      ].find((item) => item.href === pathname)?.label ?? "Gradavia");
  const commands = [
    ...destinations.map((item) => ({
      id: item.href,
      label: item.label,
      icon: item.icon,
      keywords: item.keywords,
      group: "Explorer",
      onSelect: () => router.push(item.href),
    })),
    {
      id: "sources",
      label: "Données & méthode",
      icon: Database,
      group: "Comprendre",
      onSelect: () => router.push("/sources"),
    },
    {
      id: "definition",
      label: "Comprendre le taux d’accès",
      icon: BookOpen,
      keywords: ["indicateurs", "chiffres", "définition"],
      group: "Comprendre",
      onSelect: () => router.push("/sources#indicateurs"),
    },
  ];
  return (
    <>
      <AnimatedSidebar
        ariaLabel="Navigation principale"
        panelClassName="bg-sidebar border-0"
        collapsible="icon"
      >
        <AnimatedSidebarHeader className="h-20 justify-center px-5">
          <div className="flex items-center justify-between gap-2">
            {open || isMobile ? (
              <Wordmark />
            ) : (
              <Link href="/" aria-label="Gradavia, accueil">
                <Telescope className="size-5" />
              </Link>
            )}
            {isMobile ? (
              <AnimatedSidebarClose aria-label="Fermer la navigation">
                <X className="size-4" />
              </AnimatedSidebarClose>
            ) : (
              open && (
                <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-muted-foreground">
                  BÊTA
                </span>
              )
            )}
          </div>
        </AnimatedSidebarHeader>
        <AnimatedSidebarContent className="gap-6 px-3">
          <Button
            variant="ghost"
            className="mx-0 justify-start gap-2.5 rounded-lg border border-border/70 bg-surface/50 px-3 text-[13px]"
            onClick={() => changeCommandOpen(true)}
            aria-label="Ouvrir la recherche rapide"
          >
            <Search className="size-4 shrink-0" />
            {(open || isMobile) && (
              <>
                <span className="flex-1 text-left">Recherche rapide</span>
                <kbd className="text-[10px] text-muted-foreground">⌘ K</kbd>
              </>
            )}
          </Button>
          <nav aria-label="Explorer Gradavia">
            {(open || isMobile) && (
              <p className="mb-2 px-3 text-[10px] font-medium tracking-[.08em] text-muted-foreground uppercase">
                Observatoire
              </p>
            )}
            <AnimatedSidebarMenu className="gap-1">
              {destinations.map(({ href, label, icon: Icon }) => (
                <AnimatedSidebarMenuItem key={href}>
                  <AnimatedSidebarMenuButton
                    href={href}
                    icon={<Icon className="size-[17px]" strokeWidth={1.65} />}
                    isActive={pathname.startsWith(href)}
                    className="min-h-10 rounded-lg text-[13px] font-normal"
                    badge={
                      href === "/favoris" && favorites.length
                        ? favorites.length
                        : href === "/comparer" && comparison.length
                          ? comparison.length
                          : undefined
                    }
                  >
                    {label}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
            </AnimatedSidebarMenu>
          </nav>
        </AnimatedSidebarContent>
        <AnimatedSidebarFooter className="gap-4 px-3 pb-5">
          <AnimatedSidebarMenu>
            <AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuButton
                href="/sources"
                isActive={pathname === "/sources"}
                icon={<Database className="size-[17px]" strokeWidth={1.65} />}
                className="text-[13px] font-normal"
              >
                Données & méthode
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          </AnimatedSidebarMenu>
          {(open || isMobile) && (
            <div className="px-3">
              <ThemeSelect />
            </div>
          )}
        </AnimatedSidebarFooter>
      </AnimatedSidebar>
      <div className="min-w-0 flex-1 bg-background">
        <header className="app-topbar sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-background/90 px-4 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3 text-[13px]">
            <AnimatedSidebarTrigger
              aria-label="Afficher ou masquer la navigation"
              className="text-muted-foreground"
            >
              <PanelLeft className="size-4" />
            </AnimatedSidebarTrigger>
            <span className="hidden text-muted-foreground sm:inline">
              Gradavia
            </span>
            <span aria-hidden="true" className="hidden text-border sm:inline">
              /
            </span>
            <span className="truncate font-medium">{title}</span>
          </div>
          {pathname !== "/formations" && (
            <Link
              href="/formations"
              className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Explorer les formations <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </header>
        <div className="page-frame mx-auto max-w-[1480px] px-4 pb-14 sm:px-8 lg:px-10">
          {children}
        </div>
      </div>
      <CommandPalette
        open={commandOpen}
        onOpenChange={changeCommandOpen}
        items={commands}
        placeholder="Où voulez-vous aller ?"
        emptyMessage="Aucune page ne correspond à votre recherche."
      />
    </>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return children;

  return (
    <AnimatedSidebarProvider
      style={{ "--sidebar-width": "224px", "--sidebar-width-icon": "64px" }}
    >
      <ShellContents>{children}</ShellContents>
    </AnimatedSidebarProvider>
  );
}
