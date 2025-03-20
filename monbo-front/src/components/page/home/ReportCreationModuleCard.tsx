import { ModuleCard } from "@/components/page/home/ModuleCard";

export const ReportCreationModuleCard: React.FC = () => {
  return (
    <ModuleCard
      step={4}
      textNamespace="home:report"
      color="#8C1BB5"
      imgSrc="/images/Step4Img.svg"
      disabled
    />
  );
};
