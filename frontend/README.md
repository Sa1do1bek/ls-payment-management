# Frontend

This independent HTML5, Bootstrap 5, and Vanilla JavaScript interface manages enrolled students, displays monthly debtors, and records payments through the existing Spring Boot API. No frontend build step or package installation is required.

## Navigation and Architecture

The user interface provides two primary views accessible via the responsive top navigation:

1. **Payments & Debtors**:
   - Monthly debtor report with date picker and summary metrics (debtor count, total outstanding tuition).
   - Responsive debtor records (desktop table and mobile card view).
   - Payment recording form with real-time student selection and validation.
   - Quick "Record payment" buttons directly from debtor rows.

2. **Students Directory**:
   - Full student directory with ID, name, phone, group, and monthly tuition in UZS.
   - Client-side search by name, phone, or student ID (case-insensitive).
   - Dynamic group filter dropdown derived automatically from registered students.
   - Filter reset controls and clear distinctions between "no registered students" and "no matching search results".
   - Safe DOM rendering using text APIs to prevent unsafe HTML injection.
   - Modal forms for creating and editing students with client-side input validation and double-submission protection.
   - Accessible deletion confirmation dialog with meaningful HTTP 409 financial conflict messaging.

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
  Runs 21 automated unit tests covering API requests, student CRUD operations, input validation, HTTP 409/404 handling, search and group filtering, payment dropdown synchronization, double-submission protection, and DOM text safety.

- **Real-Browser Integration Verification**:
  With PostgreSQL, Spring Boot, and the frontend server running:
  ```powershell
  node .\qa\browser-test.mjs
  ```
  Drives Chromium/Edge through Chrome DevTools Protocol (CDP), testing student creation, listing, dropdown sync, updating name/fee, debtor recalculation, payment recording, 409 conflict handling, student deletion (204), search, group filtering, and 1440px / 768px / 375px responsive layouts without horizontal overflow. Disposable test data is cleaned up automatically.
