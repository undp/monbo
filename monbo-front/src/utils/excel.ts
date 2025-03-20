import * as XLSX from "xlsx";

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

export interface SheetData {
  rows: string[][];
  merges?: XLSX.Range[];
}
export const generateExcel = (data: Record<string, SheetData>) => {
  const workbook = XLSX.utils.book_new();
  for (const sheetName in data) {
    const worksheet = XLSX.utils.aoa_to_sheet(data[sheetName].rows);
    if (data[sheetName].merges) {
      worksheet["!merges"] = data[sheetName].merges;
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  return blob;
};
