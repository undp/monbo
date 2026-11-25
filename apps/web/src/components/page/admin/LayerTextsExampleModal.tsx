"use client";

import React from "react";
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_TABLE_COMPACT_SX, FLOW_TABLE_FRAME } from "@/components/page/flow/flowTable";
import { BaseModal } from "@/components/reusable/BaseModal";
import { Text } from "@/components/reusable/Text";
import { OPTIONAL_ATTRIBUTE_KEYS } from "@/interfaces/AdminLayer";

const ATTRIBUTE_KEYS = ["name", "alias", ...OPTIONAL_ATTRIBUTE_KEYS];

/** The texts of a real layer (IDEAM, Colombia), as a model for filling in the form. */
export const LayerTextsExampleModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const example = (key: string) => t(`admin:form:example:${key}`);
  const considerations = example("values:considerations");

  return (
    <BaseModal
      isOpen={open}
      handleClose={onClose}
      title={example("title")}
      icon={<LightbulbOutlinedIcon />}
      maxWidth="md"
    >
      <Text variant="body2" sx={{ marginBottom: 2, color: FLOW_COLORS.ink2 }}>
        {example("intro")}
      </Text>
      <Box sx={{ ...FLOW_TABLE_FRAME, ...FLOW_TABLE_COMPACT_SX }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "40%" }}>{example("field")}</TableCell>
              <TableCell>{example("value")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ATTRIBUTE_KEYS.map((key) => (
              <TableRow key={key}>
                <TableCell sx={{ verticalAlign: "top" }}>
                  <Text variant="body2" bold>
                    {t(`admin:form:attributes:${key}`)}
                    {key === "name" || key === "alias" ? " *" : ""}
                  </Text>
                  <Text variant="caption" color="secondary" sx={{ display: "block" }}>
                    {example(`hints:${key}`)}
                  </Text>
                </TableCell>
                <TableCell sx={{ verticalAlign: "top" }}>{example(`values:${key}`)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ verticalAlign: "top", borderBottom: 0 }}>
                <Text variant="body2" bold>
                  {t("admin:form:considerations")}
                </Text>
                <Text variant="caption" color="secondary" sx={{ display: "block" }}>
                  {example("hints:considerations")}
                </Text>
              </TableCell>
              <TableCell sx={{ verticalAlign: "top", borderBottom: 0 }}>
                {/* What to type, then how the preview shows it. */}
                <Box
                  component="pre"
                  sx={{
                    margin: 0,
                    padding: 1.5,
                    borderRadius: "8px",
                    backgroundColor: FLOW_COLORS.blue25,
                    border: `1px solid ${FLOW_COLORS.line}`,
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {considerations}
                </Box>
                <Text variant="caption" color="secondary" sx={{ display: "block", marginTop: 1.5 }}>
                  {t("admin:form:preview")}
                </Text>
                <Box sx={{ fontSize: 14, "& h3": { fontSize: 16, marginTop: 0.5 } }}>
                  <ReactMarkdown>{considerations}</ReactMarkdown>
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </BaseModal>
  );
};
