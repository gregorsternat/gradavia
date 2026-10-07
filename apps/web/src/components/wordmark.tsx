import Link from "next/link";
import { LogoMark } from "./logo-mark";

export function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-xl font-semibold tracking-[-0.055em]"
      aria-label="Gradavia, accueil"
    >
      <LogoMark />
      gradavia
    </Link>
  );
}
