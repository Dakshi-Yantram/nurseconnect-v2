export const Colors = {
  primary: "#2563EB",
  primaryDark: "#1E3A8A",
  accent: "#8B5CF6",
  accentDark: "#6D28D9",
  teal: "#14B8A6",

  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  error: "#EF4444",
  errorBg: "#FEE2E2",
  danger: "#DC2626",
  info: "#2563EB",
  infoBg: "#DBEAFE",

  bgApp: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",

  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",

  divider: "#E2E8F0",
  border: "#E2E8F0",
};

export const Gradients = {
  primary: ["#2563EB", "#3B82F6"],
  teal: ["#14B8A6", "#06B6D4"],
  softBanner: ["#DBEAFE", "#EFF6FF"],

  splash: ["#2563EB", "#14B8A6"],
  successCard: ["#10B981", "#34D399"],
  accent: ["#8B5CF6", "#A855F7"],
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  /** Standard horizontal gutter for full-screen content. */
  screen: 20,
  /** Internal padding for cards / list rows. */
  card: 16,
};

export const Typography = {
  h1: {
    fontSize: 30,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 15,
    fontWeight: "400" as const,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  small: {
    fontSize: 12,
  },
  caption: {
    fontSize: 11,
  },
};

export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
};

export type StatusKey =
  | "scheduled"
  | "enroute"
  | "active"
  | "completed"
  | "cancelled";

export const StatusStyles = {
  scheduled: {
    bg: "#FEF3C7",
    text: "#D97706",
    label: "Scheduled",
  },

  enroute: {
    bg: "#DBEAFE",
    text: "#2563EB",
    label: "En Route",
  },

  active: {
    bg: "#DCFCE7",
    text: "#16A34A",
    label: "Active",
  },

  completed: {
    bg: "#DCFCE7",
    text: "#16A34A",
    label: "Completed",
  },

  cancelled: {
    bg: "#FEE2E2",
    text: "#DC2626",
    label: "Cancelled",
  },
};
