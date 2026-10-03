import { notFound } from "next/navigation";
import { ComponentGallery } from "@/features/playground/ui/component-gallery";

export default function UIPlayground() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main id="contenu" className="py-14">
      <p className="font-mono text-xs text-muted-foreground">DÉVELOPPEMENT</p>
      <h1 className="mt-3 text-4xl tracking-tight">Galerie des composants</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
        Un espace de vérification de l’interface. Les valeurs ci-dessous sont
        fictives et ne décrivent aucune formation.
      </p>
      <ComponentGallery />
    </main>
  );
}
