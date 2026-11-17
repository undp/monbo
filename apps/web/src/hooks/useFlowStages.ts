import { useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import { DataContext } from "@/context/DataContext";
import {
  deriveFlowStages,
  flowProgress,
  stageFromPathname,
  type FlowFlags,
} from "@/utils/flowStages";

/**
 * The current stage (from the route), each stage's state and the progress bars,
 * derived from the flow loaded in the browser. Results invalidated by a layer
 * change don't count as an analysis.
 */
export const useFlowStages = () => {
  const pathname = usePathname();
  const { polygonsValidationResults, deforestationAnalysisResults, analysisOutdated } =
    useContext(DataContext);

  const validationDone = polygonsValidationResults !== null;
  const analysisDone = deforestationAnalysisResults !== null && !analysisOutdated;

  return useMemo(() => {
    const flags: FlowFlags = { validationDone, analysisDone };
    const current = stageFromPathname(pathname);
    return {
      current,
      flags,
      stages: deriveFlowStages(current, flags),
      progress: flowProgress(current, flags),
    };
  }, [pathname, validationDone, analysisDone]);
};
