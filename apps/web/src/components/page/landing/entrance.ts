import { keyframes } from "@mui/material/styles";

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
`;

/**
 * The start page's step cards and arrows rise once, one after the other (`delay`
 * in seconds). Skipped when the user prefers reduced motion.
 */
export const entrance = (delay: number) => ({
  opacity: 0,
  animation: `${rise} .5s ease ${delay}s forwards`,
  "@media (prefers-reduced-motion: reduce)": { opacity: 1, animation: "none" },
});
