import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const sharedProps: IconProps = {
  viewBox: "0 0 32 32",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  className: "h-6 w-6 shrink-0 overflow-visible drop-shadow-[0_1px_0_rgba(15,23,42,0.22)]",
  "aria-hidden": true,
};

function PlayersIcon() {
  return (
    <svg {...sharedProps}>
      <circle cx="8" cy="11" r="4" fill="#38BDF8" stroke="#334155" strokeWidth="1.8" />
      <path d="M2.8 24.5c.4-5 2.1-7.4 5.2-7.4s4.8 2.4 5.2 7.4" fill="#60A5FA" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="11" r="4" fill="#FBBF24" stroke="#334155" strokeWidth="1.8" />
      <path d="M18.8 24.5c.4-5 2.1-7.4 5.2-7.4s4.8 2.4 5.2 7.4" fill="#F59E0B" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="9" r="5" fill="#FDE68A" stroke="#334155" strokeWidth="2" />
      <path d="M8.8 26.5c.5-6.4 2.9-9.4 7.2-9.4s6.7 3 7.2 9.4" fill="#4ADE80" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ControlsIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M8.2 10.2h15.6c2.7 0 4.6 1.8 5.1 4.4l1 5.3c.6 3.4-3.1 5.7-5.7 3.5l-3.3-2.8h-9.8l-3.3 2.8c-2.6 2.2-6.3-.1-5.7-3.5l1-5.3c.5-2.6 2.4-4.4 5.1-4.4Z" fill="#A78BFA" stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 14v5M6.5 16.5h5" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="22" cy="15.2" r="1.7" fill="#22D3EE" stroke="#334155" strokeWidth="1.2" />
      <circle cx="25.7" cy="18.5" r="1.7" fill="#FB7185" stroke="#334155" strokeWidth="1.2" />
      <path d="M13 10.2 14.6 7h2.8l1.6 3.2" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M5 24a12 12 0 0 1 22 0" fill="#FDBA74" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 20.8a8 8 0 0 1 14 0" fill="#FACC15" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m16 21 6-7" stroke="#EF4444" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.3" fill="#F8FAFC" stroke="#334155" strokeWidth="1.8" />
      <path d="M4 9h5M2 14h5" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 4h6" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4v4" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GameplayIcon() {
  return (
    <svg {...sharedProps}>
      <path d="m7 5 8.2 8.2-3 3L4 8l.4-3.4L7 5Z" fill="#60A5FA" stroke="#334155" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m25 5-8.2 8.2 3 3L28 8l-.4-3.4L25 5Z" fill="#FB7185" stroke="#334155" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="m11 15 6 6M21 15l-6 6" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      <path d="m8.4 19.6 4 4M23.6 19.6l-4 4" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
      <path d="m6 26 3.2-3.2M26 26l-3.2-3.2" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function PerspectiveIcon() {
  return (
    <svg {...sharedProps}>
      <path d="M3 16s4.6-7 13-7 13 7 13 7-4.6 7-13 7S3 16 3 16Z" fill="#F8FAFC" stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="5.2" fill="#22D3EE" stroke="#334155" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.2" fill="#4338CA" />
      <circle cx="14.5" cy="14.5" r="1" fill="white" />
      <path d="m25.5 5 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="#FACC15" stroke="#334155" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS: Record<string, () => ReactElement> = {
  controls: ControlsIcon,
  loading: LoadingIcon,
  perspective: PerspectiveIcon,
  players: PlayersIcon,
  pvp: GameplayIcon,
};

export function GameFilterGroupIcon({ icon }: { icon: string }) {
  const Icon = ICONS[icon] || ControlsIcon;
  return <Icon />;
}
