// The analysis flow's three stages (validation, territorial analysis, report) and
// how each one's state is derived from the route and the flow loaded in the
// browser. Pure functions: the stepper and its tests share them.

export type FlowStage = 1 | 2 | 3;

export const FLOW_STAGES: readonly FlowStage[] = [1, 2, 3];

/**
 * - `current`: the page the user is on.
 * - `done`: the stage has results.
 * - `available`: it can be opened (stage 2 before it is done, stage 3 with results).
 * - `skipped`: the user moved past it without doing it (it stays optional).
 * - `locked`: stage 3 without analysis results; it can't be opened.
 */
export type FlowStageState = "current" | "done" | "available" | "skipped" | "locked";

export interface FlowFlags {
  /** Polygon validation results exist. */
  validationDone: boolean;
  /** Analysis results exist and are not outdated. */
  analysisDone: boolean;
}

export interface FlowStageView {
  stage: FlowStage;
  state: FlowStageState;
  /** Key in the `flow` namespace for the line under the stage's name. */
  labelKey: string;
}

// The routes of each stage, sub-pages included.
const STAGE_ROUTES: Record<FlowStage, string> = {
  1: "polygons-validation",
  2: "territorial-analysis",
  3: "report-generation",
};

/** The stage a pathname belongs to, with or without its locale prefix. */
export const stageFromPathname = (pathname: string): FlowStage | null => {
  const segments = pathname.split("/").filter(Boolean);
  // A locale prefix is two lowercase letters (`/es/...`); the default has none.
  const first = /^[a-z]{2}$/.test(segments[0] ?? "") ? segments[1] : segments[0];
  return FLOW_STAGES.find((stage) => STAGE_ROUTES[stage] === first) ?? null;
};

const stageState = (
  stage: FlowStage,
  current: FlowStage | null,
  { validationDone, analysisDone }: FlowFlags
): FlowStageState => {
  if (stage === current) return "current";
  if (stage === 1) return validationDone ? "done" : "skipped";
  if (stage === 2) {
    if (analysisDone) return "done";
    return current !== null && current > 2 ? "skipped" : "available";
  }
  return analysisDone ? "available" : "locked";
};

const LABEL_KEYS: Record<FlowStageState, string> = {
  current: "stepper.states.current",
  done: "stepper.states.done",
  available: "stepper.states.available",
  skipped: "stepper.states.skipped",
  locked: "stepper.states.locked",
};

/** Each stage's state and label, for the stepper. */
export const deriveFlowStages = (
  current: FlowStage | null,
  flags: FlowFlags
): FlowStageView[] =>
  FLOW_STAGES.map((stage) => {
    const state = stageState(stage, current, flags);
    // "Go straight there" is only for stage 2; stage 3 with results is "available".
    const labelKey =
      state === "available" && stage === 2
        ? "stepper.states.direct"
        : LABEL_KEYS[state];
    return { stage, state, labelKey };
  });

/**
 * How much of each of the two bars between the stages is filled, from 0 to 1:
 * full once the stage before it is done or passed, partly on the stage itself.
 */
export const flowProgress = (
  current: FlowStage | null,
  { validationDone, analysisDone }: FlowFlags
): [number, number] => {
  const at = current ?? 0;
  const first = at > 1 || validationDone ? 1 : 0.35;
  const second = at > 2 || analysisDone ? 1 : at === 2 ? 0.35 : 0;
  return [first, second];
};

/**
 * Where pressing a stage goes: its results when it has them, its upload page
 * otherwise. Stage 2 with farms loaded goes to its layers, where the polygon subset
 * and the layers are chosen. Stage 3 always goes to the report (it is only
 * pressable with results).
 */
export const stageHref = (
  stage: FlowStage,
  { validationDone, analysisDone }: FlowFlags,
  { farmsLoaded = false }: { farmsLoaded?: boolean } = {}
) => {
  if (stage === 1)
    return validationDone ? "/polygons-validation" : "/polygons-validation/upload-data";
  if (stage === 2) {
    if (analysisDone) return "/territorial-analysis";
    return farmsLoaded ? "/territorial-analysis/layers" : "/territorial-analysis/upload-data";
  }
  return "/report-generation";
};

/**
 * What pressing a stage does:
 * - `none`: the current stage. It is the page the user is on, so it goes nowhere;
 *   the stepper doesn't render it as a control.
 * - `navigate`: anything else goes to `stageHref`, with no dialog on the way. Stage
 *   2 without results goes to its selection page, where the polygon subset and the
 *   layers are chosen and nothing starts until "Analizar" (D5); stage 3 goes to the
 *   report page, where its polygons and layers are chosen and nothing renders until
 *   "Generar vista previa".
 */
export type StageAction = "none" | "navigate";

export const stageAction = (stage: FlowStage, current: FlowStage | null): StageAction =>
  stage === current ? "none" : "navigate";
