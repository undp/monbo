"use client";

import { ModuleCard } from "@/components/page/home/ModuleCard";
// import { useModuleRouter } from "@/hooks/useModuleRouter";

export const ReportCreationModuleCard: React.FC = () => {
  // const goToModule = useModuleRouter("/report-generation");

  return (
    <ModuleCard
      step={3}
      textNamespace="home:report"
      color="#8C1BB5"
      imgSrc="/images/Step4Img.svg"
      // onPress={goToModule}
    />
  );
};
