import { ModuleCard } from "@/components/page/home/ModuleCard";

export const BatchCreationModuleCard: React.FC = () => {
  return (
    <ModuleCard
      step={3}
      textNamespace="home:batches"
      color="#12B953"
      imgSrc="/images/Step3Img.svg"
      disabled
    />
  );
};
