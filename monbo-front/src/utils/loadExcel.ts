import {
  readExcel,
  getSheetDataById,
  sheetToJson,
  removeFirstNRow,
} from "@/utils/excel";
import { WorkSheet } from "xlsx";
import { validateData } from "./modules";
import { TFunction } from "i18next";

const headerKeywordsMappings: Record<string, string[]> = {
  // finalKey: ["keyword1", "keyword2", "keyword3"]
  id: ["id"],
  producerName: ["productor", "producer"],
  productionDate: ["fecha", "date"],
  productionQuantity: ["cantidad", "quantity"],
  productionQuantityUnit: ["unidad", "measurement"],
  country: ["país", "country"],
  region: ["región", "region"],
  farmCoordinates: ["coordenadas", "coordinates"],
  area: ["superficie", "area"],
  cropType: ["cultivo", "crop"],
  association: ["asociación", "cooperative"],
  documentName1: ["nombre documento 1", "document name 1"],
  documentUrl1: ["enlace documento 1", "document link 1"],
  documentName2: ["nombre documento 2", "document name 2"],
  documentUrl2: ["enlace documento 2", "document link 2"],
  documentName3: ["nombre documento 3", "document name 3"],
  documentUrl3: ["enlace documento 3", "document link 3"],
};

const mandatoryHeaders: string[] = [
  "producerName",
  "productionDate",
  "productionQuantity",
  "productionQuantityUnit",
  "country",
  "farmCoordinates",
  "area",
  "cropType",
];

const parseExcelData = (worksheet: WorkSheet) => {
  // Check mandatory headers
  const headersData = sheetToJson(worksheet, { range: "A1:AA3", header: 1 });

  const headers = headersData[1] as string[];

  // Get all data
  const dataSheet = removeFirstNRow(worksheet, 1);
  return {
    data: sheetToJson(dataSheet).slice(1) as Record<string, string>[],
    headers,
  };
};

type MappedData = Record<string, unknown> & {
  documents: { name: string; url: string }[];
};

interface LoadExcelFileReturn {
  data: MappedData[];
  errorMessages: string[];
}

export const loadExcelFile = async (
  file: File,
  t: TFunction<"translation", undefined>,
  language: string
): Promise<LoadExcelFileReturn> => {
  const excel = await readExcel(file);
  const worksheet = getSheetDataById(excel, 0);
  const { data, headers } = parseExcelData(worksheet);

  // Create a mapping from Excel header to our internal key
  const headerToKeyMap: Record<string, string> = {};
  Object.entries(headerKeywordsMappings).forEach(([internalKey, keywords]) => {
    headers.forEach((header) => {
      if (keywords.some((kw) => header.toLowerCase().includes(kw))) {
        headerToKeyMap[header] = internalKey;
      }
    });
  });

  // Remapping data based on header keywords
  const mappedData: MappedData[] = data.map((row) => {
    const newRow: MappedData = {
      documents: [] as MappedData["documents"],
    };

    // Apply mapping to current row
    Object.entries(row).forEach(([excelHeader, value]) => {
      const internalKey = headerToKeyMap[excelHeader];
      if (internalKey) {
        newRow[internalKey] = value as string;

        // Trim the value if it's a string
        if (typeof newRow[internalKey] === "string") {
          newRow[internalKey] = newRow[internalKey].trim();
        }

        // If the value is an empty string, set it to null
        if (newRow[internalKey] === "") {
          newRow[internalKey] = null;
        }
      }
    });

    // Convert id to string if it's a number
    if (typeof newRow.id === "number") {
      newRow.id = newRow.id.toString();
    }

    // Convert productionDate to ISO string if it's a Date
    const dateValue = newRow.productionDate as unknown as Date; // The package returns a Date object automatically
    if (dateValue instanceof Date) {
      newRow.productionDate = dateValue.toISOString();
    }

    return newRow;
  });

  // Consolidate the documents into an array
  mappedData.forEach((row) => {
    row.documents = [];
    if (row.documentUrl1) {
      row.documents.push({
        name: (row.documentName1 as string) ?? "",
        url: row.documentUrl1 as string,
      });
    }
    if (row.documentUrl2) {
      row.documents.push({
        name: (row.documentName2 as string) ?? "",
        url: row.documentUrl2 as string,
      });
    }
    if (row.documentUrl3) {
      row.documents.push({
        name: (row.documentName3 as string) ?? "",
        url: row.documentUrl3 as string,
      });
    }
    delete row.documentName1;
    delete row.documentUrl1;
    delete row.documentName2;
    delete row.documentUrl2;
    delete row.documentName3;
    delete row.documentUrl3;
  });

  // Validate data
  const errorMessages = validateData({
    data: mappedData as Record<string, string | number | null>[],
    mandatoryHeaders,
    t,
    language,
  });

  return {
    data: mappedData,
    errorMessages,
  };
};
