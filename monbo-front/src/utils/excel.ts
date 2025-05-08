import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { TFunction } from "i18next";
import { isCountryCode } from "./countries";

// TODO: refactor to use only the exceljs library

/**
 * Creates an Excel cell object with line break support and centered vertical alignment.
 *
 * @param {string} value - The text content to be displayed in the cell
 * @returns {XLSX.CellObject} A cell object configured with text wrapping and vertical centering
 *
 * @example
 * const cell = createCellWithLineBreaks("Line 1\nLine 2");
 * // Returns a cell object that will display the text on multiple lines
 *
 * @remarks
 * The returned cell object has the following properties:
 * - Value (v): The actual text content
 * - Type (t): Set to "s" for string
 * - Style (s): Contains alignment settings for text wrapping and vertical centering
 */
export const createCellWithLineBreaks = (
  value: string
): string | XLSX.CellObject => {
  return {
    v: value
      .split("\r\n")
      .join(String.fromCharCode(13) + String.fromCharCode(10)), // The cell value
    t: "s", // Type: string
    s: {
      alignment: {
        wrapText: true, // Enable text wrapping
        vertical: "center",
      },
    },
  };
  // Replace \n with the ASCII character for line feed (char 10)
  const valueWithChar10 = value.replace(/\n/g, String.fromCharCode(13));
  // Create XML with explicit line breaks
  const xmlValue = value.includes("\n")
    ? value.split("\n").join(String.fromCharCode(13) + String.fromCharCode(10))
    : value;

  return {
    v: valueWithChar10, // The cell value
    t: "s", // Type: string
    h: xmlValue,
    s: {
      alignment: {
        wrapText: true, // Enable text wrapping
        vertical: "center",
      },
    },
  };
};

/**
 * Reads an Excel file and returns a workbook object.
 *
 * @param {File} file - The Excel file to be read
 * @returns {Promise<XLSX.WorkBook>} A promise that resolves to the workbook object
 *
 * @remarks
 * This function:
 * - Uses FileReader to read the file as an ArrayBuffer
 * - Configures XLSX to parse dates properly using cellDates option
 * - Returns a Promise that resolves with the parsed workbook
 *
 * @example
 * const fileInput = document.getElementById('fileInput');
 * fileInput.addEventListener('change', async (event) => {
 *   const file = event.target.files[0];
 *   const workbook = await readExcel(file);
 *   // Process workbook data
 * });
 *
 * @throws {Error} If the file cannot be read or parsed as an Excel workbook
 */
export const readExcel = async (file: File): Promise<XLSX.WorkBook> => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (event) => {
      const binaryStr = event.target?.result;
      const workbook = XLSX.read(binaryStr, {
        type: "binary",
        cellDates: true,
        raw: true, // To prevent type conversion
        cellText: true, // To get raw text values
      });

      resolve(workbook);
    };
    reader.onerror = (event) => {
      reject(event);
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Retrieves the data of a specific sheet from a workbook by its name.
 *
 * @param {XLSX.WorkBook} workbook - The workbook object containing multiple sheets.
 * @param {string} sheetName - The name of the sheet to retrieve data from.
 * @returns {XLSX.WorkSheet} The sheet data corresponding to the provided sheet name.
 * @throws {Error} If the sheet name is not found in the workbook.
 */
export const getSheetDataByName = (
  workbook: XLSX.WorkBook,
  sheetName: string
) => {
  const sheetId = workbook.SheetNames.findIndex((name) => name === sheetName);
  const sheet = workbook.Sheets[workbook.SheetNames[sheetId]];
  return sheet;
};

/**
 * Retrieves the data of a specific sheet from a workbook by its sheet index.
 *
 * @param {XLSX.WorkBook} workbook - The workbook object containing multiple sheets.
 * @param {number} sheetId - The index of the sheet to retrieve.
 * @returns {XLSX.WorkSheet} The sheet data corresponding to the specified sheet index.
 * @throws {Error} If the sheet index is out of bounds or the workbook has no sheets.
 */
export const getSheetDataById = (workbook: XLSX.WorkBook, sheetId: number) => {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetId]];
  return sheet;
};

/**
 * Converts an Excel worksheet to a JSON array.
 *
 * @param {XLSX.WorkSheet} sheet - The Excel worksheet to convert
 * @param {XLSX.Sheet2JSONOpts} [options] - Optional parameters to customize the conversion:
 *   - blankrows: Whether to include blank rows (default: false)
 *   - raw: Whether to return raw values vs formatted values (default: true)
 *   - Other options supported by XLSX.utils.sheet_to_json()
 * @returns {Array} A JSON array representing the worksheet data, with each element
 *                  corresponding to a row in the worksheet
 */
export const sheetToJson = (
  sheet: XLSX.WorkSheet,
  options?: XLSX.Sheet2JSONOpts
) => {
  const defaultOptions: XLSX.Sheet2JSONOpts = {
    blankrows: false, // Skip empty rows
    raw: true, // Return raw values
    defval: null, // Default value for empty cells
    rawNumbers: true, // Keep numbers as raw strings
  };
  return XLSX.utils.sheet_to_json(sheet, { ...defaultOptions, ...options });
};

/**
 * Removes the first N rows from the given worksheet by modifying the sheet's reference range.
 *
 * @param {XLSX.WorkSheet} sheet - The worksheet from which rows will be removed.
 * @param {number} n - The number of rows to remove from the top of the worksheet.
 * @throws {Error} If the sheet is empty or has no reference range defined.
 * @returns {XLSX.WorkSheet} The modified worksheet with the first N rows removed.
 *
 * @remarks
 * This function:
 * - Modifies the worksheet's reference range (!ref) to exclude the first N rows
 * - Does not actually delete the row data, just updates the visible range
 * - Returns the same worksheet object that was passed in
 * - Preserves all other worksheet properties and cell data
 */
export const removeFirstNRow = (sheet: XLSX.WorkSheet, n: number) => {
  if (!sheet["!ref"]) {
    throw new Error("Sheet is empty");
  }
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  range.s.r = n;
  sheet["!ref"] = XLSX.utils.encode_range(range);
  return sheet;
};

/**
 * Creates an Excel worksheet from a 2D array of data with optional cell merges.
 *
 * @param {(string | XLSX.CellObject)[][]} data - 2D array containing the worksheet data. Each inner array represents
 *                           a row, and each element represents a cell value or cell object.
 * @param {SheetData["merges"]} merges - Optional array of cell ranges to merge in the worksheet.
 *                                       Each range specifies start and end cells to merge.
 * @returns {XLSX.WorkSheet} A new worksheet containing the formatted data with:
 *                          - Proper handling of line breaks in cell values
 *                          - Cell merges applied if specified
 *                          - Auto-sized columns (25 characters width)
 *                          - Dynamic row heights based on content (40pt for wrapped text, 20pt standard)
 *                          - Hidden recalculation formula to force Excel updates
 */
export const createWorksheet = (
  data: (string | XLSX.CellObject)[][],
  merges?: SheetData["merges"]
) => {
  const ws = XLSX.utils.aoa_to_sheet([]);

  // Process each row and cell to handle line breaks
  data.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });

      // If it's already a cell object, use it as is
      if (cell && typeof cell === "object" && "v" in cell) {
        ws[cellRef] = cell;
      }
      // If it's a string with newlines, convert to cell object
      else if (typeof cell === "string" && cell.includes("\n")) {
        ws[cellRef] = createCellWithLineBreaks(cell);
      }
      // Otherwise, just set the value
      else {
        ws[cellRef] = { v: cell };
      }
    });
  });

  // Set the ref attribute
  if (data.length > 0 && data[0].length > 0) {
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: {
        r: data.length - 1,
        c: Math.max(...data.map((row) => row.length)) - 1,
      },
    });
  }

  // Apply merges if provided
  if (merges) {
    ws["!merges"] = merges;
  }

  // Set explicit column widths
  ws["!cols"] = [];
  for (let i = 0; i < (data[0]?.length || 0); i++) {
    // Column with wrapped text should be wider
    ws["!cols"].push({ wch: 25 });
  }

  // Set explicit row heights for any row containing wrapped text
  ws["!rows"] = [];
  for (let i = 0; i < data.length; i++) {
    const hasWrappedText = data[i].some(
      (cell) => typeof cell === "string" && cell.includes("\n")
    );

    if (hasWrappedText) {
      ws["!rows"][i] = { hpt: 40 }; // Taller rows for wrapped text
    } else {
      ws["!rows"][i] = { hpt: 20 }; // Standard height
    }
  }

  // Add a hidden cell with a formula that forces Excel to recalculate
  const hiddenCellRef = XLSX.utils.encode_cell({ r: 0, c: 50 });
  ws[hiddenCellRef] = { f: 'REPLACE("a","a","a")', t: "f", h: "" };

  return ws;
};

export interface SheetData {
  rows: (string | XLSX.CellObject)[][];
  merges?: XLSX.Range[];
}

/**
 * Generates an Excel workbook with multiple sheets from provided data.
 *
 * @param {Record<string, SheetData>} data - Object mapping sheet names to their data
 * @returns {Promise<Blob>} Excel file as a Blob
 *
 * @remarks
 * This function:
 * - Creates a new Excel workbook using ExcelJS
 * - For each sheet:
 *   - Sets consistent column widths (30 for first 20 columns)
 *   - Adds rows with proper text wrapping and height adjustment
 *   - Applies any cell merges specified
 *   - Makes first two rows bold
 * - Configures text wrapping and vertical alignment for all cells
 * - Adjusts row heights based on content (taller for wrapped text)
 *
 * @example
 * const sheetData = {
 *   "Sheet1": {
 *     rows: [["Header1", "Header2"], ["Data1", "Data2"]],
 *     merges: [{s: {r: 0, c: 0}, e: {r: 0, c: 1}}]
 *   }
 * };
 * const excelBlob = await generateExcel(sheetData);
 */
export const generateExcel = async (data: Record<string, SheetData>) => {
  const workbook = new ExcelJS.Workbook();

  Object.entries(data).forEach(([sheetName, sheetData]) => {
    const worksheet = workbook.addWorksheet(sheetName);

    // Set column widths for first 20 columns
    worksheet.columns = Array(20)
      .fill(null)
      .map(() => ({
        width: 30,
      }));

    // Add rows
    sheetData.rows.forEach((row, idx) => {
      const excelRow = worksheet.addRow(row);

      // Set row height (in points)
      const hasWrappedText = row.some(
        (cell) => typeof cell === "string" && cell.includes("\n")
      );
      excelRow.height = hasWrappedText ? 25 : 16; // Taller rows for wrapped text

      for (let i = 0; i < row.length; i++) {
        const cell = worksheet.getCell(idx + 1, i + 1);

        cell.alignment = {
          wrapText: true,
          vertical: "top",
        };
      }
      // Commit the changes to ensure they're applied
      excelRow.commit();
    });

    // Apply merges if any
    if (sheetData.merges) {
      sheetData.merges.forEach((merge) => {
        worksheet.mergeCells(
          merge.s.r + 1,
          merge.s.c + 1,
          merge.e.r + 1,
          merge.e.c + 1
        );
      });
    }

    // Apply bold formatting AFTER all rows are created and merged
    // This ensures it doesn't get overwritten by any other operations
    for (let rowIndex = 1; rowIndex <= 2; rowIndex++) {
      const row = worksheet.getRow(rowIndex);
      row.eachCell({ includeEmpty: true }, (cell) => {
        // Create a completely new font object
        cell.font = {
          bold: true,
          name: "Calibri",
          size: 12,
          color: { argb: "000000" },
        };
      });
      row.commit();
    }
  });

  // Write to buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return blob;
};

/**
 * Loads and extracts header rows from a predefined Excel template file for the given locale.
 *
 * @param locale - The locale code (e.g. 'en', 'es', 'pt') to get the template headers for
 * @returns A promise that resolves to a 2D array containing the first 3 rows of headers from the template file:
 *          - Row 1: Main headers in both languages
 *          - Row 2: Sub-headers in both languages
 *          - Row 3: Example values
 *
 * @remarks
 * The template files are stored in the public directory with naming pattern:
 * `/files/upload-file-template-{locale}.xlsx`
 *
 * The function:
 * 1. Gets the template path for the locale
 * 2. Fetches and reads the Excel file
 * 3. Extracts just the first 3 header rows
 *
 * @example
 * ```ts
 * const headers = await loadTemplateHeaders('en');
 * // headers = [
 * //   ['ID', 'Producer Name', ...],      // Row 1 - Main headers
 * //   ['ID', 'Name', ...],               // Row 2 - Sub-headers
 * //   ['1', 'John Smith', ...]           // Row 3 - Examples
 * // ]
 * ```
 *
 * @throws {Error} If the template file cannot be fetched or parsed for the given locale
 */
export const loadTemplateHeaders = async (
  locale: string
): Promise<string[][]> => {
  // Path to your template in the public directory
  const templatePath = getUploadFileTemplatePath(locale);

  // Fetch the template file
  const response = await fetch(templatePath);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }

  const templateArrayBuffer = await response.arrayBuffer();

  // Load the template workbook
  const templateWorkbook = XLSX.read(templateArrayBuffer, { type: "array" });

  // Get the first sheet name
  const firstSheetName = templateWorkbook.SheetNames[0];

  // Get the first worksheet
  const templateSheet = templateWorkbook.Sheets[firstSheetName];

  // Convert to JSON to easily extract header rows
  const templateData: string[][] = XLSX.utils.sheet_to_json(templateSheet, {
    header: 1,
  });

  // Extract the first 3 rows (headers)
  const headerRows = templateData.slice(0, 3);

  return headerRows;
};

const headerKeywordsMappings: Record<string, string[]> = {
  // attribute: [es-header, en-header]
  id: ["id", "id"],
  producerName: ["nombre productor", "producer name"],
  productionDate: ["fecha producción", "production date"],
  productionQuantity: ["cantidad producción", "production quantity"],
  productionQuantityUnit: [
    "unidad cantidad producción",
    "production measurement unit",
  ],
  country: ["país", "country"],
  region: ["región", "region"],
  farmCoordinates: ["coordenadas finca", "land coordinates"],
  area: ["superficie [hectáreas]", "area [hectares]"],
  cropType: ["tipo de cultivo", "crop type"],
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
  "cropType",
];

interface ValidateDataParams {
  data: Record<string, string | number | null>[];
  mandatoryHeaders: string[];
  t: TFunction<"translation", undefined>;
  language: string;
}

/**
 * Validates the provided data against mandatory headers and performs data validation checks.
 *
 * @param {Object} params - The parameters for the validation function.
 * @param {Array<Object>} params.data - The data to be validated, where each object represents a row.
 * @param {Array<string>} params.mandatoryHeaders - The list of mandatory headers that must be present and non-empty in each row.
 * @param {Function} params.t - Translation function for error messages.
 * @param {string} params.language - The language code ('en' or 'es') to be used for validation messages.
 * @returns {string[]} Array of error messages found during validation.
 * @throws {Error} Throws an error if a row contains an invalid country code.
 *
 * @remarks
 * This function performs the following validations:
 * - Checks that all mandatory headers have non-empty values
 * - Validates farm coordinates are in the format [(x1,y1), (x2,y2), ...]
 * - Verifies country codes match ISO 3166-1 alpha-2 format
 *
 * Row numbers in error messages account for the 3 header rows in the template.
 */
export const validateData = ({
  data,
  mandatoryHeaders,
  t,
  language,
}: ValidateDataParams): string[] => {
  const errorMessages: string[] = [];

  data.forEach((row, idx) => {
    const rowIdx = idx + 3; // The template has 3 rows of headers, so we need to add 3 to the index for proper row numbering
    // Check if all mandatory headers are present in each row
    mandatoryHeaders.forEach((header) => {
      if (!row[header]) {
        const errorMsg = t("common:parseFileError:mandatoryDataMissing", {
          header: headerKeywordsMappings[header][language === "es" ? 0 : 1],
          row: rowIdx,
        });
        errorMessages.push(errorMsg);
      }
    });

    //Check if coordinates are valid
    const coordinatesRegex =
      /^\[\s*(\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,?\s*)*\]$/;
    if (
      "farmCoordinates" in row &&
      typeof row["farmCoordinates"] === "string" &&
      !coordinatesRegex.test(row["farmCoordinates"])
    ) {
      const errorMsg = t("common:parseFileError:invalidCoordinates", {
        row: rowIdx,
      });
      errorMessages.push(errorMsg);
    }

    // Check the country is ISO 3166-1 alpha-2
    const country = row["country"] as string;
    if (!isCountryCode(country)) {
      const errorMsg = t("common:parseFileError:invalidCountryCode", {
        row: rowIdx,
      });
      throw new Error(errorMsg);
    }
  });

  return errorMessages;
};

/**
 * Parses an Excel worksheet to extract headers and data.
 *
 * @param {XLSX.WorkSheet} worksheet - The Excel worksheet to parse
 * @returns {{
 *   data: Record<string, string>[],
 *   headers: string[]
 * }} An object containing:
 *   - data: Array of records representing the worksheet data (excluding headers)
 *   - headers: Array of header strings from row 2 of the worksheet
 *
 * @remarks
 * This function:
 * - Extracts headers from row 2 (index 1) of the worksheet
 * - Removes the first row and returns remaining data as an array of records
 * - Assumes headers are in range A1:AA3 (3 header rows total)
 * - Returns data starting from row 4 (after skipping 3 header rows)
 * - Headers are taken from row 2 specifically, rows 1 and 3 are ignored
 */
const parseExcelData = (
  worksheet: XLSX.WorkSheet
): {
  data: Record<string, string>[];
  headers: string[];
} => {
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

/**
 * Loads and processes farm data from an Excel file.
 *
 * @param {File} file - The Excel file to process
 * @param {TFunction} t - Translation function for error messages
 * @param {string} language - Current language code for translations
 * @returns {Promise<LoadExcelFileReturn>} Object containing:
 *   - data: Array of processed farm records with consolidated document data
 *   - errorMessages: Array of validation error messages
 *
 * @remarks
 * This function:
 * - Reads the Excel file and extracts data from first sheet
 * - Maps Excel headers to internal data structure using headerKeywordsMappings
 * - Processes special fields:
 *   - Trims string values and converts empty strings to null
 *   - Converts numeric IDs to strings
 *   - Converts production dates to ISO strings
 *   - Consolidates document fields into a documents array
 * - Validates mandatory fields and returns any validation errors
 *
 * @example
 * const result = await loadExcelFileFarmsData(file, t, 'en');
 * if (result.errorMessages.length > 0) {
 *   // Handle validation errors
 * } else {
 *   // Process result.data
 * }
 */
export const loadExcelFileFarmsData = async (
  file: File,
  t: TFunction<"translation", undefined>,
  language: string
): Promise<LoadExcelFileReturn> => {
  const excel = await readExcel(file);
  const worksheet = getSheetDataById(excel, 0);
  const { data, headers } = parseExcelData(worksheet);

  // Create a mapping from Excel header to our internal key
  const headerToKeyMap: Record<string, string> = {};
  Object.entries(headerKeywordsMappings).forEach(
    ([internalKey, expectedHeaders]) => {
      headers.forEach((incomingHeader) => {
        if (!incomingHeader) return;
        // Split header by newline and get the first part
        const cleanHeaderParts = incomingHeader
          .split(/\r?\n/)
          .map((part) => part.toLowerCase().trim());
        if (expectedHeaders.some((h) => cleanHeaderParts.includes(h))) {
          headerToKeyMap[incomingHeader] = internalKey;
        }
      });
    }
  );

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

/**
 * Gets the path to the Excel template file for the specified locale
 * @param locale - The locale code (e.g. 'en', 'es', 'pt') to get the template for
 * @returns The file path to the localized Excel template
 */
export const getUploadFileTemplatePath = (locale: string): string => {
  return `/files/m1-upload-file-template-${locale}.xlsx`;
};
