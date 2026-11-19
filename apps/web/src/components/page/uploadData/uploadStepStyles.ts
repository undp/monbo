import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

export interface HowToLink {
  label: string;
  href: string;
  /** A template to fill in, shown with a download icon */
  template?: boolean;
}

/** A link of the "how to" panel: blue text, also on its buttons. */
export const HOW_TO_LINK = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0.5,
  padding: 0,
  border: "none",
  background: "none",
  font: "inherit",
  fontSize: 14,
  fontWeight: 500,
  color: FLOW_COLORS.blue,
  textDecoration: "none",
  cursor: "pointer",
  "&:hover": { textDecoration: "underline" },
} as const;
