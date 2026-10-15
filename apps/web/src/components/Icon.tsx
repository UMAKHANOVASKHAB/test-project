// Иконки нарисованы вручную в одном стиле с логотипом: тонкая линия, скруглённые концы.
// Вместо смайликов, которые на разных телефонах выглядят по-разному.

const PATHS = {
  cup: (
    <>
      <path d="M5 9.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9.5z" />
      <path d="M16 10.5h1.25a2.5 2.5 0 0 1 0 5H16" />
      <path d="M9 3.5c-.7.9-.7 1.9 0 2.8M12.5 3.5c-.7.9-.7 1.9 0 2.8" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8.5h13l-1 11.5h-11l-1-11.5z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="4" rx="1" />
      <path d="M5.5 13v7h13v-7M12 9v11" />
      <path d="M12 9C10.5 6 7 5.5 7 7.8 7 9 9.5 9 12 9zm0 0c1.5-3 5-3.5 5-1.2C17 9 14.5 9 12 9z" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  snow: <path d="M12 3.5v17M4.6 7.75l14.8 8.5M4.6 16.25l14.8-8.5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
