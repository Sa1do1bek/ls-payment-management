/**
 * CSV Serialization and Export Utilities
 *
 * Provides RFC 4180-compliant CSV generation with UTF-8 BOM for Microsoft Excel
 * compatibility, CRLF line endings, exact integer monetary formatting, and
 * formula injection defense against spreadsheet execution risks.
 */

export const UTF8_BOM = '\uFEFF';
export const CRLF = '\r\n';

export const DEBTOR_CSV_HEADERS = [
  'studentId',
  'name',
  'phone',
  'groupName',
  'monthlyFee',
  'paidAmount',
  'debt',
];

export const STUDENT_CSV_HEADERS = [
  'id',
  'name',
  'phone',
  'groupName',
  'monthlyFee',
];

/**
 * Validates and formats a monetary amount or ID as a non-negative whole integer string.
 * Rejects decimals, negative values, and unsafe integers to prevent precision loss.
 *
 * @param {number|string} value
 * @param {string} fieldName
 * @returns {string} Exact integer string
 */
export function formatMonetaryCell(value, fieldName = 'Amount') {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${fieldName} must be a non-negative safe integer.`);
    }
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`${fieldName} must be a non-negative integer string.`);
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num)) {
      throw new Error(`${fieldName} exceeds safe integer limit.`);
    }
    return trimmed;
  }
  throw new Error(`${fieldName} must be an integer.`);
}

/**
 * Sanitizes untrusted text fields for CSV export.
 *
 * 1. Formula injection protection:
 *    If the text, after trimming leading whitespace/control characters, begins with
 *    formula triggers (=, +, -, @), it is prefixed with a single quote (') so spreadsheet
 *    software (Excel, LibreOffice Calc, Google Sheets) interprets it strictly as text.
 *    Uzbek phone numbers starting with +998 are safely neutralized this way.
 *
 * 2. RFC 4180 escaping:
 *    If the field contains double quotes, commas, carriage returns, or line feeds,
 *    embedded double quotes are escaped by doubling them (""), and the entire field
 *    is enclosed in double quotes.
 *
 * @param {unknown} value
 * @returns {string} Sanitized CSV cell
 */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);

  // Strip leading ASCII and Unicode whitespace and control characters to detect disguised formula triggers
  const trimmedLeading = str.replace(/^[\s\u0000-\u001F\u007F-\u009F]+/, '');
  let sanitized = str;

  // Formula trigger characters: =, +, -, @
  if (/^[=+\-@]/.test(trimmedLeading)) {
    sanitized = `'${str}`;
  }

  // RFC 4180 quoting rules: wrap in double quotes if commas, quotes, or newlines are present
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * Formats a debtor object into an RFC 4180 CSV row string.
 * Column order: studentId,name,phone,groupName,monthlyFee,paidAmount,debt
 *
 * @param {object} debtor
 * @returns {string}
 */
export function formatDebtorRow(debtor) {
  if (!debtor || typeof debtor !== 'object') {
    throw new Error('Debtor record must be a valid object.');
  }
  return [
    formatMonetaryCell(debtor.studentId, 'studentId'),
    sanitizeCsvCell(debtor.name),
    sanitizeCsvCell(debtor.phone),
    sanitizeCsvCell(debtor.groupName),
    formatMonetaryCell(debtor.monthlyFee, 'monthlyFee'),
    formatMonetaryCell(debtor.paidAmount, 'paidAmount'),
    formatMonetaryCell(debtor.debt, 'debt'),
  ].join(',');
}

/**
 * Formats a student object into an RFC 4180 CSV row string.
 * Column order: id,name,phone,groupName,monthlyFee
 *
 * @param {object} student
 * @returns {string}
 */
export function formatStudentRow(student) {
  if (!student || typeof student !== 'object') {
    throw new Error('Student record must be a valid object.');
  }
  return [
    formatMonetaryCell(student.id, 'id'),
    sanitizeCsvCell(student.name),
    sanitizeCsvCell(student.phone),
    sanitizeCsvCell(student.groupName),
    formatMonetaryCell(student.monthlyFee, 'monthlyFee'),
  ].join(',');
}

/**
 * Builds the complete CSV string for a monthly debtor list.
 * Includes UTF-8 BOM, header line, CRLF line endings, and each debtor row.
 * Generates an RFC 4180 compliant header-only CSV when the debtor array is empty.
 *
 * @param {Array<object>} debtors
 * @returns {string}
 */
export function buildDebtorsCsv(debtors) {
  if (!Array.isArray(debtors)) {
    throw new Error('Debtors must be provided as an array.');
  }
  const lines = [
    DEBTOR_CSV_HEADERS.join(','),
    ...debtors.map(formatDebtorRow),
  ];
  return UTF8_BOM + lines.join(CRLF) + CRLF;
}

/**
 * Builds the complete CSV string for a student directory list.
 * Includes UTF-8 BOM, header line, CRLF line endings, and each student row.
 * Generates an RFC 4180 compliant header-only CSV when the student array is empty.
 *
 * @param {Array<object>} students
 * @returns {string}
 */
export function buildStudentsCsv(students) {
  if (!Array.isArray(students)) {
    throw new Error('Students must be provided as an array.');
  }
  const lines = [
    STUDENT_CSV_HEADERS.join(','),
    ...students.map(formatStudentRow),
  ];
  return UTF8_BOM + lines.join(CRLF) + CRLF;
}

/**
 * Derives the filename for monthly debtor export: debtors-YYYY-MM.csv.
 *
 * @param {string} month YYYY-MM
 * @returns {string}
 */
export function debtorExportFilename(month) {
  if (typeof month === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month.trim())) {
    return `debtors-${month.trim()}.csv`;
  }
  return 'debtors.csv';
}

/**
 * Initiates a browser download for the generated CSV text.
 * Uses Blob and temporary object URL with cleanup.
 *
 * @param {string} csvContent
 * @param {string} filename
 */
export function downloadCsv(csvContent, filename) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
