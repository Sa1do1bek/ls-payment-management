# Frontend

This independent HTML5, Bootstrap 5, and Vanilla JavaScript interface manages enrolled students, displays monthly debtors, records payments, and provides secure client-side CSV reporting through the existing Spring Boot API. No frontend build step or package installation is required.

## Navigation and Architecture

The user interface provides two primary views accessible via the responsive top navigation:

1. **Payments & Debtors**:
   - Monthly debtor report with date picker and summary metrics (debtor count, total outstanding tuition).
   - Responsive debtor records (desktop table and mobile card view).
   - Payment recording form with real-time student selection and validation.
   - Quick "Record payment" buttons directly from debtor rows.
   - **Monthly Debtor CSV Export**: One-click download of the active month's debtors (`debtors-YYYY-MM.csv`).

2. **Students Directory**:
   - Full student directory with ID, name, phone, group, and monthly tuition in UZS.
   - Client-side search by name, phone, or student ID (case-insensitive).
   - Dynamic group filter dropdown derived automatically from registered students.
   - Filter reset controls and clear distinctions between "no registered students" and "no matching search results".
   - Safe DOM rendering using text APIs to prevent unsafe HTML injection.
   - Modal forms for creating and editing students with client-side input validation and double-submission protection.
   - Accessible deletion confirmation dialog with meaningful HTTP 409 financial conflict messaging.
   - **Student Directory CSV Export**: One-click export of registered students (`students.csv`) respecting active search and group filters.

## CSV Export & Security Architecture

CSV generation occurs entirely in the client using data already returned by REST endpoints, without creating backend load or introducing new database queries:

- **RFC 4180 & Spreadsheet Compatibility**:
  - Encoded in UTF-8 with Byte Order Mark (BOM: `\uFEFF`) ensuring Microsoft Excel, Apple Numbers, and LibreOffice Calc render Cyrillic and Uzbek characters (`G'aniyev`, `Шодиев`) correctly without encoding prompts.
  - Fields separated by commas (`,`), with standard CRLF (`\r\n`) line endings across all lines.
  - RFC 4180 double-quoting for fields containing commas, double quotes, carriage returns, or line feeds. Embedded double quotes are escaped by doubling (`""`).

- **Formula Injection Defense (CSV Injection Protection)**:
  - Untrusted text fields (student names, phone numbers, group names) are protected against formula execution in spreadsheet software.
  - Fields whose value (after trimming leading whitespace or control characters) begins with formula trigger prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`) are prefixed with an apostrophe (`'`).
  - Uzbek phone numbers commonly formatted as `+998...` are safely exported as `'+998...`, rendering strictly as text in Excel and LibreOffice Calc without trigger execution.

- **Financial Precision**:
  - Monetary values (`monthlyFee`, `paidAmount`, `debt`) are exported as exact non-negative integer strings without thousands separators, decimals, or currency symbols.
  - Values exceeding JavaScript safe-integer bounds or containing fractional amounts are rejected before serialization.

- **Export Columns & Filenames**:
  - **Monthly Debtors**: `studentId,name,phone,groupName,monthlyFee,paidAmount,debt` saved to `debtors-YYYY-MM.csv` matching the loaded report month.
  - **Student Directory**: `id,name,phone,groupName,monthlyFee` saved to `students.csv`, preserving active filter results and displayed sort ordering.

- **Empty-List & Stale State Policy**:
  - When a dataset is empty (0 debtors in the selected month, or 0 students matching active search/filter), clicking Export safely generates an RFC 4180-compliant header-only CSV with BOM and CRLF, displaying a clear notice (`Exported filename.csv (0 records, headers only)`).
  - Debtor export is disabled while report requests are in flight, upon fetch errors, or when the month input has changed before clicking Refresh (preventing stale export).

## Student Management Workflow

- **Create student**: Accessible via the `+ Add student` button. Consumes `POST /api/students`. Validates non-blank name ($\le$ 150 chars), phone ($\le$ 30 chars), group ($\le$ 100 chars), and positive safe-integer monthly fee in UZS. On creation, the student is immediately selectable in the payment form, and debtor balances refresh for the selected month.
- **Edit student**: Consumes `PUT /api/students/{id}` with full replacement. Prepopulates current values and validates input. Updating a student's fee immediately recalculates outstanding debts across the current reporting month.
- **Delete student**: Consumes `DELETE /api/students/{id}` with mandatory confirmation. Students without payments return HTTP 204, disappearing from the directory and payment selector. Students with recorded payment history return HTTP 409 and cannot be deleted; the UI retains them and explains that financial history prevents deletion.
- **Cross-View Synchronization**: Renamed students update immediately in the payment selector. Deleting a currently selected student safely clears the selection. Fee modifications automatically trigger debtor re-computation for the active reporting month.

## Run locally on Windows PowerShell

Start PostgreSQL and the backend as described in the [root README](../README.md). In a separate PowerShell window at the repository root, start the included static HTTP server:

```powershell
node .\frontend\serve.mjs
```

Open `http://127.0.0.1:5500` in a browser. Do not open `index.html` through `file://`; browser module imports and API requests need an HTTP origin. The static server binds only to the local machine. Bootstrap 5.3.3 styles load from a pinned CDN URL, so the browser needs internet access for those styles.

The API base URL is defined once in `js/config.js` and defaults to `http://localhost:8080`. The backend permits CORS requests from `http://127.0.0.1:5500` and `http://localhost:5500` for GET, POST, PUT, and DELETE operations.

## Testing and verification

- **Frontend Automated Tests**:
  From the repository root, run:
  ```powershell
  node --test .\frontend\tests\api.test.mjs
  ```
  Runs 36 automated unit tests covering API requests, student CRUD operations, input validation, HTTP 409/404 handling, search and group filtering, payment dropdown synchronization, double-submission protection, DOM text safety, UTF-8 BOM, CRLF line endings, exact debtor/student header order, formula injection neutralization (`=`, `+`, `-`, `@`, `+998`), RFC 4180 quoting and quote doubling, Unicode preservation, exact integer monetary formatting, header-only empty CSV generation, and dynamic filename generation.

- **Real-Browser Integration Verification**:
  With PostgreSQL, Spring Boot, and the frontend server running:
  ```powershell
  node .\qa\browser-test.mjs
  ```
  Drives Chromium/Edge through Chrome DevTools Protocol (CDP), testing student creation, listing, dropdown sync, updating name/fee, debtor recalculation, payment recording, 409 conflict handling, student deletion (204), search, group filtering, debtor CSV export with BOM, stale month export protection, filtered student directory CSV export, and 1440px / 768px / 375px responsive layouts without horizontal overflow. Disposable test data is cleaned up automatically.
