import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef } from "react";

export const useModuleRouter = (path?: string) => {
  const { farmsData } = useContext(DataContext);
  const dataRef = useRef(farmsData);
  const router = useRouter();

  useEffect(() => {
    dataRef.current = farmsData;
  }, [farmsData]);

  const goToPath = useCallback(() => {
    if (!path) return;
    if (path === "/") {
      router.push(path);
      return;
    }

    router.push(!dataRef.current ? `${path}/upload-data` : path);
  }, [path, router]);

  return goToPath;
};
