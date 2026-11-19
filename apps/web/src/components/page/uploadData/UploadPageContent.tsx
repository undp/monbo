"use client";

import React from "react";
import { FlowPage } from "@/components/page/flow/FlowPage";
import { FlowPageHead } from "@/components/page/flow/FlowPageHead";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

// The flow header above shows the testing-environment warning.
export const UploadPageContent: React.FC<Props> = ({ title, subtitle, children }) => (
  <FlowPage>
    <FlowPageHead title={title} subtitle={subtitle} />
    {children}
  </FlowPage>
);
