/**
 * Inline icon set.
 *
 * Kept local rather than pulling an icon package: the app needs a dozen glyphs,
 * and shipping them as components keeps the bundle honest and lets every icon
 * inherit `currentColor`.
 *
 * Every icon is decorative by default (`aria-hidden`) — it always sits beside
 * real text. That matters most for status icons: a severity colour never
 * carries meaning on its own.
 */
type IconProps = {
  className?: string;
  /** Set only when an icon is the sole content of a control. */
  title?: string;
};

function Svg({
  className = "size-4",
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

// --- Navigation ------------------------------------------------------------

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="11" width="7" height="10" rx="1.5" />
    <rect x="3" y="15" width="7" height="6" rx="1.5" />
  </Svg>
);

export const IconOrders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4" />
    <path d="M9 12h7M9 16h5" />
  </Svg>
);

export const IconStages = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
    <path d="M7 12h3M14 12h3" />
  </Svg>
);

export const IconMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const IconSequence = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h10M4 12h16M4 18h7" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="13" cy="18" r="2" />
  </Svg>
);

export const IconBrush = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20c0-2 1-3 3-3 1.5 0 2 1 2 2s-1 2-2.5 2S4 20.5 4 20Z" />
    <path d="M9 17 18.5 5.5a2 2 0 0 1 3 2.6L11 18" />
  </Svg>
);

export const IconTruck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 7h11v9H2zM13 10h4.5l2.5 3v3H13z" />
    <circle cx="6" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 11.5a3 3 0 1 0-1-5.8M17 20c0-2-.6-3.6-1.7-4.7" />
  </Svg>
);

export const IconStore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9h16v11H4z" />
    <path d="M3 9l2-5h14l2 5" />
    <path d="M9 20v-6h6v6" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-8.5 8.5" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

// --- Status ----------------------------------------------------------------
// Each one is always rendered next to a text label.

export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.5 2.5L16 9.5" />
  </Svg>
);

export const IconAlertTriangle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 2.5 20h19z" />
    <path d="M12 10v4.5M12 17.5h.01" />
  </Svg>
);

export const IconAlertOctagon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7z" />
    <path d="M12 8v5M12 16h.01" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.75h.01" />
  </Svg>
);
