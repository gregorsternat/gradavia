export function LogoMark({
  size = 24,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        fill={color}
        d="M20 5.5C18 3.3 15.4 2.5 12 2.5a9.5 9.5 0 0 0 0 19h9.5v-11H11V14h7v4h-6a6 6 0 0 1 0-12c2.4 0 4.1.8 5.5 2.1L20 5.5Z"
      />
    </svg>
  );
}
