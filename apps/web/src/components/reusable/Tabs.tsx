"use client";

import { Box, Tabs as MUITabs, Slide, Tab } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useRef } from "react";

interface TabPanelProps {
  children?: React.ReactNode;
  index: string;
  value: string;
  containerRef: HTMLDivElement | null;
}
const CustomTabPanel = (props: TabPanelProps) => {
  const { children, value, index, containerRef } = props;

  return (
    <Slide
      direction="left"
      in={value === index}
      mountOnEnter
      unmountOnExit
      container={containerRef}
    >
      <Box sx={{ position: "absolute", width: "100%", height: "100%" }}>
        {children}
      </Box>
    </Slide>
  );
};

interface TabsProps {
  tabs: {
    id: string;
    title: React.ReactNode;
    content: React.ReactNode;
  }[];
}

export const Tabs: React.FC<TabsProps> = ({ tabs }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const value = searchParams.get("tab") || tabs[0].id;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (event: React.SyntheticEvent, newValue: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("tab", newValue);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  return (
    <Box
      ref={containerRef}
      sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}
    >
      <Box>
        <MUITabs value={value} onChange={handleChange}>
          {tabs.map((tab, index) => (
            <Tab key={index} label={tab.title} value={tab.id} />
          ))}
        </MUITabs>
      </Box>
      <Box
        sx={{
          position: "relative",
          overflowX: "hidden",
          flexGrow: 1,
          marginTop: 1,
        }}
      >
        {tabs.map((tab, index) => (
          <CustomTabPanel
            key={index}
            value={value}
            index={tab.id}
            containerRef={containerRef.current}
          >
            {tab.content}
          </CustomTabPanel>
        ))}
      </Box>
    </Box>
  );
};
