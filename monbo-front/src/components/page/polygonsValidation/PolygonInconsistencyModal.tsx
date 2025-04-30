"use client";

import React from "react";
import { RowData } from "@/components/reusable/Table";
import { InconsistentPolygonData } from "@/interfaces/PolygonValidation";
import { OverlapInconsistencyModal } from "./OverlapInconsistencyModal";
import { GeometryInconsistencyModal } from "./GeometryInconsistencyModal";

interface PolygonDetailModalProps {
  isOpen: boolean;
  handleClose: () => void;
  row: RowData<InconsistentPolygonData> | null;
}
export const PolygonInconsistencyModal: React.FC<PolygonDetailModalProps> = ({
  isOpen,
  handleClose,
  row,
}) => {
  return row?.data?.type === "overlap" ? (
    <OverlapInconsistencyModal
      isOpen={isOpen}
      handleClose={handleClose}
      row={
        row as RowData<Extract<InconsistentPolygonData, { type: "overlap" }>>
      }
    />
  ) : (
    <GeometryInconsistencyModal
      isOpen={isOpen}
      handleClose={handleClose}
      row={
        row as RowData<Exclude<InconsistentPolygonData, { type: "overlap" }>>
      }
    />
  );
};
