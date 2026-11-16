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
  2: "deforestation-analysis",
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
 * otherwise. Stage 3 always goes to the report (it is only pressable with results).
 */
export const stageHref = (stage: FlowStage, { validationDone, analysisDone }: FlowFlags) => {
  if (stage === 1)
    return validationDone ? "/polygons-validation" : "/polygons-validation/upload-data";
  if (stage === 2)
    return analysisDone ? "/deforestation-analysis" : "/deforestation-analysis/upload-data";
  return "/report-generation";
};

/** The report's choices, as far as the stepper needs them. */
export interface ReportSelection {
  /** Layers chosen for the report. */
  reportMapIds: number[];
  /** Layers of the current analysis. */
  analysisMapIds: number[];
  /** Farms chosen for the report. */
  selectedFarmsCount: number;
}

/**
 * Whether the report can open as it is: its layers were chosen, all of them are
 * in the current analysis, and it has farms. Layers are saved as soon as they are
 * ticked in the report modal, but farms only when it is confirmed, so layers alone
 * don't mean the modal was completed.
 */
export const isReportSelectionReady = ({
  reportMapIds,
  analysisMapIds,
  selectedFarmsCount,
}: ReportSelection) =>
  reportMapIds.length > 0 &&
  selectedFarmsCount > 0 &&
  reportMapIds.every((id) => analysisMapIds.includes(id));

/**
 * What pressing a stage does:
 * - `analysisModal`: stage 2 after a validation and before an analysis opens the
 *   analysis modal, where the polygon subset and the layers are chosen, as the
 *   stage 1 card does. Stage 2 stays open to everyone (D5).
 * - `reportModal`: stage 3 opens the report layer modal unless the report's
 *   choices are ready.
 * - `navigate`: anything else goes to `stageHref`.
 */
export type StageAction = "navigate" | "analysisModal" | "reportModal";

export const stageAction = (
  stage: FlowStage,
  { validationDone, analysisDone }: FlowFlags,
  reportSelection: ReportSelection
): StageAction => {
  if (stage === 2 && validationDone && !analysisDone) return "analysisModal";
  if (stage === 3 && !isReportSelectionReady(reportSelection)) return "reportModal";
  return "navigate";
};
