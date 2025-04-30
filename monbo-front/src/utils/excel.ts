import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

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
 * @param {File} file - The Excel file to be read.
 * @returns {Promise<XLSX.WorkBook>} A promise that resolves to the workbook object.
 *
 * @example
 * const fileInput = document.getElementById('fileInput');
 * fileInput.addEventListener('change', async (event) => {
 *   const file = event.target.files[0];
 *   const workbook = await readExcel(file);
 *   console.log(workbook);
 * });
 *
 * @throws Will throw an error if the file cannot be read.
 */
export const readExcel = async (file: File): Promise<XLSX.WorkBook> => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (event) => {
      const binaryStr = event.target?.result;
      const workbook = XLSX.read(binaryStr, {
        type: "binary",
        cellDates: true,
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
 * @param workbook - The workbook object containing multiple sheets.
 * @param sheetName - The name of the sheet to retrieve data from.
 * @returns The sheet data corresponding to the provided sheet name.
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
 */
export const getSheetDataById = (workbook: XLSX.WorkBook, sheetId: number) => {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetId]];
  return sheet;
};

/**
 * Converts an Excel worksheet to a JSON array.
 *
 * @param sheet - The Excel worksheet to convert.
 * @param options - Optional parameters to customize the conversion.
 * @returns A JSON array representing the worksheet data.
 */
export const sheetToJson = (
  sheet: XLSX.WorkSheet,
  options?: XLSX.Sheet2JSONOpts
) => {
  const defaultOptions: XLSX.Sheet2JSONOpts = {
    blankrows: false, // Skip empty rows
    raw: true, // Return raw values
  };
  return XLSX.utils.sheet_to_json(sheet, { ...defaultOptions, ...options });
};

/**
 * Removes the first N rows from the given worksheet.
 *
 * @param {XLSX.WorkSheet} sheet - The worksheet from which rows will be removed.
 * @param {number} n - The number of rows to remove from the top of the worksheet.
 * @throws {Error} If the sheet is empty.
 * @returns {XLSX.WorkSheet} The modified worksheet with the first N rows removed.
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
 * @param {string[][]} data - 2D array containing the worksheet data. Each inner array represents
 *                           a row, and each element represents a cell value.
 * @param {SheetData["merges"]} merges - Optional array of cell ranges to merge in the worksheet.
 *                                       Each range specifies start and end cells to merge.
 * @returns {XLSX.WorkSheet} A new worksheet containing the formatted data with:
 *                          - Proper handling of line breaks in cell values
 *                          - Cell merges applied if specified
 *                          - Auto-sized columns (max width 30 characters)
 *                          - Reference range set based on data dimensions
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

export const generateExcel = (data: Record<string, SheetData>) => {
  const workbook = XLSX.utils.book_new();
  for (const sheetName in data) {
    const worksheet = createWorksheet(
      data[sheetName].rows,
      data[sheetName].merges
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const writeOpts: XLSX.WritingOptions = {
    bookType: "xlsx",
    bookSST: false,
    type: "array",
    cellStyles: true,
  };

  const excelBuffer = XLSX.write(workbook, writeOpts);
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  return blob;
};

export const generateExcel2 = async (data: Record<string, SheetData>) => {
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

export const loadTemplateHeaders = async (): Promise<string[][]> => {
  // Path to your template in the public directory
  const templatePath = "/files/polygon-validation-template.xlsx";

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
