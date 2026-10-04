import Link from "next/link";

export function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 text-xl font-semibold tracking-[-0.055em]"
      aria-label="Gradavia, accueil"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4.5 16.5 9 12l4 2 6.5-8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      gradavia
    </Link>
  );
}
