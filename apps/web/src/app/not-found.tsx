import { NotFoundMagnetic } from "@/components/motion/not-found/magnetic";

export default function NotFound() {
  return (
    <main id="contenu" tabIndex={-1} className="py-10 sm:py-16">
      <NotFoundMagnetic className="min-h-[60vh]" />
    </main>
  );
}
