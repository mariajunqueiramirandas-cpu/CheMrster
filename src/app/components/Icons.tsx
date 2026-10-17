/** Hand-drawn icon set, stroked like the molecules (2px, round joins). */
import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const FlameIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c1 3.2 5 5.6 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.4-4.6.2 1.6 1 2.6 2.1 3C11 9 11 6 12 3Z" />
  </svg>
);

export const BoltIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.2 4.2L19 7" />
  </svg>
);

export const CrossIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CloseIcon = CrossIcon;

/** Benzene ring: the "path" tab. */
export const PathIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5 19.4 7.8v8.4L12 20.5l-7.4-4.3V7.8Z" />
    <path d="M7.4 9.4v5.2M12 17.6l4.5-2.6M16.5 9 12 6.4" />
  </svg>
);

/** Zig-zag chain: the "structures" tab. */
export const ChainIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 15.5 7 9l5 6.5L17 9l4.5 6.5" />
  </svg>
);

export const LockIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </svg>
);

export const PrintIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2" />
    <rect x="7" y="14" width="10" height="6" />
  </svg>
);

/** A speech bubble with a ring inside: the tutor. */
export const TutorIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4.5 3.5V17.5H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
    <path d="M12 7.6 14.6 9.1v3L12 13.6l-2.6-1.5v-3Z" />
  </svg>
);

/** Three cards joined like atoms: the concept map. */
export const MapIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3.5" width="7" height="5" rx="1.2" />
    <rect x="14.5" y="9.5" width="7" height="5" rx="1.2" />
    <rect x="4.5" y="15.5" width="7" height="5" rx="1.2" />
    <path d="M9.5 6.5 14.5 11M8 15.5l6.5-3" />
  </svg>
);

/** Three columns: the study board. */
export const BoardIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="5" height="16" rx="1.2" />
    <rect x="10" y="4" width="5" height="10" rx="1.2" />
    <rect x="17" y="4" width="4" height="6" rx="1.2" />
  </svg>
);

/** Rising columns: progress. */
export const ChartIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20h16" />
    <path d="M6.5 16v-3M11 16V9M15.5 16v-5M20 16V5" />
  </svg>
);

export const SlidersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const StopIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
  </svg>
);

/** A pin: save to the concept map. */
export const PinIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 3.5h6l-1 5 3 3H7l3-3-1-5ZM12 11.5V21" />
  </svg>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" />
  </svg>
);

export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h9.5a5 5 0 0 1 0 10H12" />
  </svg>
);

/** Four corners: fit everything on screen. */
export const FitIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  </svg>
);

/** A lamp: a hint. */
export const HintIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />
  </svg>
);

export const NoteIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4h14v11l-5 5H5Z" />
    <path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4" />
  </svg>
);

/** An arrow between two dots: link two cards. */
export const LinkIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="5" cy="17" r="2" />
    <path d="M7 15 17.5 6.5M13 6h5v5" />
  </svg>
);

export const MoreIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3.2} />
  </svg>
);

export const HistoryIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
    <path d="M3.5 4v4.5H8M12 7.5V12l3 2" />
  </svg>
);

export const ExpandIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </svg>
);

export const EditIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9l-4-4L4 16Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </svg>
);

export const ArrowRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);
