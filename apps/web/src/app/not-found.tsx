import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="contenu"
      className="flex flex-1 flex-col justify-center gap-6 py-24"
    >
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-4xl tracking-tight">Cette page n’existe pas.</h1>
      <Link href="/" className="w-fit underline underline-offset-4">
        Revenir à l’accueil
      </Link>
    </main>
  );
}
