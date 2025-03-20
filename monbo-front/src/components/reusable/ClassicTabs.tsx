"use client";

import { Box, Tabs as MUITabs, SxProps, Tab } from "@mui/material";
import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";

function CustomTabPanel(
  props: PropsWithChildren<{
    index: number;
    value: number;
  }>
) {
  const { children, value, index, ...other } = props;

  if (value !== index) return null;
  return (
    <div
      role="tabpanel"
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      <Box>{children}</Box>
    </div>
  );
}

interface TabsProps {
  styles?: {
    root?: SxProps;
    tabsContainer?: SxProps;
    tab?: SxProps;
    contentContainer?: SxProps;
  };
  tabs: {
    id: number;
    title: React.ReactNode;
    content: React.ReactNode;
  }[];
  onChange?: (tabId: number) => void;
  fullWidth?: boolean;
}

export const ClassicTabs: React.FC<TabsProps> = ({
  styles = {},
  tabs,
  onChange,
  fullWidth = false,
}) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const handleChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setSelectedTab(newValue);
      onChange?.(newValue);
    },
    [setSelectedTab, onChange]
  );

  useEffect(() => {
    if (selectedTab >= tabs.length) {
      // If selected tab index is out of bounds, reset to first tab
      setSelectedTab(0);
      onChange?.(0);
    }
  }, [tabs.length, selectedTab, onChange]);

  return (
    <Box
      sx={{
        width: "100%",
        ...styles.root,
      }}
    >
      <Box
        sx={{
          borderBottom: 1,
          borderWidth: 2,
          borderColor: "divider",
          ...styles.tabsContainer,
        }}
      >
        <MUITabs
          value={selectedTab}
          onChange={handleChange}
          variant={fullWidth ? "fullWidth" : "standard"}
          aria-label="Content tabs"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              label={tab.title}
              sx={styles?.tab}
              id={`simple-tab-${tab.id}`}
              aria-controls={`simple-tabpanel-${tab.id}`}
            />
          ))}
        </MUITabs>
      </Box>
      <Box
        sx={{
          ...styles.contentContainer,
        }}
      >
        {tabs.map((tab) => (
          <CustomTabPanel
            key={tab.id}
            value={tabs[selectedTab].id}
            index={tab.id}
          >
            {tab.content}
          </CustomTabPanel>
        ))}
      </Box>
    </Box>
  );
};
