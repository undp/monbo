import type { components } from "@/api/schema";

// Product settings the API owns and publishes at GET /config, loaded once at startup
// by RuntimeConfigGate before any page renders. Synchronous on purpose: the
// formatting helpers (and the PDF report) read them outside React.

export type RuntimeConfig = components["schemas"]["ConfigData"];

let runtimeConfig: RuntimeConfig | null = null;

export const setRuntimeConfig = (config: RuntimeConfig) => {
  runtimeConfig = config;
};

export const isRuntimeConfigLoaded = () => runtimeConfig !== null;

const loaded = (): RuntimeConfig => {
  if (runtimeConfig === null) {
    // Reading a threshold before the gate has loaded the config is a bug: a silent 0
    // would mislabel overlaps and deforestation.
    throw new Error("Runtime config read before GET /config loaded");
  }
  return runtimeConfig;
};

/** The whole config, to hand it to the PDF worker (which has its own module copy). */
export const getRuntimeConfig = (): RuntimeConfig => loaded();

/** Overlap threshold, in percent (0-100). */
export const getOverlapThreshold = () => loaded().overlapThresholdPercentage;

/** Deforestation threshold, in percent (0-100). */
export const getDeforestationThreshold = () =>
  loaded().deforestationThresholdPercentage;
