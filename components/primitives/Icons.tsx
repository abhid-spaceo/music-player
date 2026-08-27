/**
 * Icon paths copied verbatim from the design canvas. Stroke widths follow the
 * markup (1.7 tab/header, 1.8 shuffle), not the design note's claim of 1.5 —
 * the note and the markup disagree and the markup is what was drawn.
 * All stroked icons use currentColor so one `color` drives icon and label.
 */

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
} as const;

type S = { size?: number };

export const LibraryIcon = ({ size = 21 }: S) => (
  <svg {...stroke} width={size} height={size} strokeWidth={1.7} aria-hidden="true">
    <path d="M4 4v16" />
    <path d="M9 3v18" />
    <path d="M14.5 3.5l4.5 17" />
  </svg>
);

export const SearchIcon = ({ size = 21 }: S) => (
  <svg {...stroke} width={size} height={size} strokeWidth={1.7} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const PlaylistsIcon = ({ size = 21 }: S) => (
  <svg {...stroke} width={size} height={size} strokeWidth={1.7} aria-hidden="true">
    <path d="M4 6h11" />
    <path d="M4 12h11" />
    <path d="M4 18h7" />
    <circle cx="18" cy="16" r="3" />
    <path d="M21 16V7" />
  </svg>
);

/** Queue replaces Downloads: there is no offline mode in this architecture. */
export const QueueIcon = ({ size = 21 }: S) => (
  <svg {...stroke} width={size} height={size} strokeWidth={1.7} aria-hidden="true">
    <path d="M4 7h11" />
    <path d="M4 12h11" />
    <path d="M4 17h7" />
    <path d="M17 10v8" />
    <path d="M14 14l3-4 3 4" />
  </svg>
);

export const ShuffleIcon = ({ size = 18 }: S) => (
  <svg
    {...stroke}
    width={size}
    height={size}
    strokeWidth={1.8}
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 3h5v5" />
    <path d="M4 20 21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);

export const PlayIcon = ({ size = 20, color = 'currentColor' }: S & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M7 4l13 8-13 8z" />
  </svg>
);

export const PauseIcon = ({ size = 20, color = 'currentColor' }: S & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const AdminIcon = ({ size = 21 }: S) => (
  <svg {...stroke} width={size} height={size} strokeWidth={1.7} aria-hidden="true">
    <path d="M12 3l7 3.5v5c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5v-5z" />
    <path d="M12 9v5" />
    <path d="M9.5 11.5h5" />
  </svg>
);
