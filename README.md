# Educational Center Payment Management

This repository contains the Spring Boot API and an independent frontend for managing payments and viewing monthly tuition debts.

## Project structure

```text
ls-payment-management/
├── backend/              Spring Boot application, Maven Wrapper, Flyway, tests
├── frontend/             HTML5, Bootstrap 5, Vanilla JavaScript, local static server
├── qa/                   Disposable real-PostgreSQL regression and browser test scripts
├── docker-compose.yml    Local PostgreSQL
├── .env.example           Safe local configuration example
├── .gitignore
└── README.md
```

The backend uses Java 21, Spring Boot 3.5.16, Spring Web, Spring Data JPA / Hibernate, Jakarta Bean Validation, Flyway, and JUnit 5. PostgreSQL runs from the 17 Alpine image. The frontend uses HTML5, CSS3, Bootstrap 5.3.3, and Vanilla JavaScript modules, with no bundler.

## Prerequisites

Install Java 21, Node.js 20 or newer (tested with 24.19.0), PowerShell 7 for the optional API regression script, and Docker Desktop or Docker Engine with the Compose plugin. The Maven Wrapper downloads Maven 3.9.11 automatically on its first run. Node.js serves the independent frontend without any package installation or other global tools.

## Set up and run on Windows PowerShell

In the first PowerShell window, run these commands from the repository root. Port 5433 is used because port 5432 may already be occupied on a developer machine:

```powershell
Copy-Item .env.example .env
$example = Get-Content .env
$example -replace '^DB_PORT=5432$', 'DB_PORT=5433' | Set-Content .env
$env:DB_PASSWORD = 'change-me-for-local-development'
$env:DB_PORT = '5433'
docker compose up -d --wait
```

In a second PowerShell window, start at the repository root, then run the backend from `backend/`:

```powershell
cd backend
$env:DB_PASSWORD = 'change-me-for-local-development'
$env:DB_PORT = '5433'
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

The example password is for a disposable local database. Use a different secret in shared environments. Docker Compose reads the root `.env` file; Spring Boot reads `DB_PASSWORD` from the shell. If you edit database values in `.env`, set matching shell variables before running the backend. `DB_HOST`, `DB_PORT`, `DB_NAME`, and `DB_USERNAME` can override the backend defaults. The default database address is `localhost:5432/payment_management`.

If port 5433 is also occupied, choose another free port in `.env` and use that same `DB_PORT` value in the backend shell. An existing PostgreSQL named volume retains its original database password; changing `.env` alone will not update that database user. Run `docker compose down` from the repository root to stop PostgreSQL without deleting its named volume.

Flyway applies `backend/src/main/resources/db/migration/V1__create_students_and_payments.sql` when the backend starts. Hibernate validates the mapped schema; it does not create or update tables.

In a third PowerShell window at the repository root, serve the frontend and open the shown URL:

```powershell
node .\frontend\serve.mjs
```

Open `http://127.0.0.1:5500` in your browser. The frontend calls the backend at `http://localhost:8080`, configured in `frontend/js/config.js`. The backend allows the documented local frontend origins (`localhost:5500` and `127.0.0.1:5500`) to make GET, POST, PUT, and DELETE requests. The pinned Bootstrap CDN stylesheet requires internet access. Do not use `file://` to open the page.

## Test and verify

From `backend/`, run `.\mvnw.cmd test` for the 68 automated health, student, payment, debtor, and CORS tests or `.\mvnw.cmd clean verify` to compile, test, and package the backend. These tests use MockMvc and Mockito and need no database. From the repository root, run `node --test .\frontend\tests\api.test.mjs` for the 36 automated frontend API, student management, and CSV export tests. Database migration and JPA validation run against PostgreSQL when the backend starts. Browser verification requires both servers running.

With PostgreSQL and the backend running, execute the real-database API regression from the repository root:

```powershell
$env:DB_PASSWORD = 'change-me-for-local-development'
$env:DB_PORT = '5433'
.\qa\verify-api.ps1
```

The script tests CRUD, payments, debt boundaries, validation, and both debtor routes. It creates uniquely named disposable students and removes only their exact IDs in a `finally` block. It needs Docker Compose to remove its own payment records because the API intentionally has no payment-delete endpoint. Check the cleanup output if a run is interrupted.

With the backend running, open another PowerShell window and run:

```powershell
$response = Invoke-WebRequest http://localhost:8080/api/health
$response.StatusCode
$response.Content
```

The expected result is HTTP 200 with `{"status":"UP"}`.

## Original assignment coverage

| Requirement | Implementation |
| --- | --- |
| Student CRUD | `/api/students` endpoints below |
| Payment creation and history | `POST /api/payments` and `GET /api/students/{studentId}/payments` |
| Monthly debtor endpoint | `GET /api/debtors?month=YYYY-MM` and compatibility route `/debtors` |
| Telegram bot or mobile-friendly web interface | Mobile-friendly web interface at `http://127.0.0.1:5500`; no Telegram bot |
| Student management frontend | Interactive browser directory, creation, full-replacement editing, safe deletion, search, and group filtering |
| CSV Reporting | Secure client-side debtor export (`debtors-YYYY-MM.csv`) and filtered student export (`students.csv`) |
| Setup instructions | This README and `frontend/README.md` |
| Improvements with one more week | Listed at the end of this README |

## Student Management & CSV Reporting Frontend

The web frontend at `http://127.0.0.1:5500` integrates student lifecycle management and CSV export directly alongside the payment and debtor views:

- **Navigation**: Clean top tabs switch seamlessly between **Payments & Debtors** and **Students** without full-page reloads.
- **Directory and Listing**: Shows Student ID, Name, Phone, Group, Monthly tuition in UZS, and action buttons. Converts to compact mobile cards below 992px. DOM text APIs ensure safe rendering of names and group text containing HTML characters.
- **Student Creation**: Accessible modal form (`POST /api/students`). Validates name (max 150), phone (max 30), group (max 100), and positive whole safe-integer monthly fee in UZS. Prevents duplicate submissions while in flight. Newly created students immediately become selectable in the payment form and trigger debtor recalculation for the active reporting month.
- **Student Editing**: Accessible modal form (`PUT /api/students/{id}`). Prepopulates existing details. On success, updates the table, refreshes payment dropdown options (preserving valid selections), and recalculates monthly debtor totals to reflect the new tuition fee.
- **Student Deletion**: Protected deletion modal (`DELETE /api/students/{id}`). Deleting a student without payment records returns HTTP 204, removes the student from directory and payment dropdowns, and refreshes the debtor summary. If the student has recorded payment history, the backend returns HTTP 409 conflict: the modal displays the backend message, explains that financial records prevent deletion, and leaves the student intact.
- **Search and Filtering**: Real-time client-side search across Student Name, Phone, and ID (case-insensitive), combinable with a dynamic group dropdown derived from available students. Clear distinctions are made between an empty directory and zero search matches, with a one-click filter reset.
- **Monthly Debtor CSV Export**: Generates `debtors-YYYY-MM.csv` containing columns `studentId,name,phone,groupName,monthlyFee,paidAmount,debt`. Exports exactly the debtors returned by `GET /api/debtors?month=YYYY-MM` for the selected reporting month. The export button is automatically disabled while loading, on fetch errors, or when the month input has changed before clicking Refresh (preventing stale export).
- **Student Directory CSV Export**: Generates `students.csv` containing columns `id,name,phone,groupName,monthlyFee`. Exports the students currently visible under active search and group filters, preserving the displayed sort order.
- **CSV Security & Encoding**:
  - UTF-8 with Byte Order Mark (`\uFEFF`) ensures Microsoft Excel and spreadsheet programs automatically recognize Cyrillic and Uzbek characters (`G'aniyev`, `Шодиев`) without encoding corruption.
  - Strict RFC 4180 compliance with CRLF (`\r\n`) line endings, comma separation, and quote doubling (`""`).
  - Formula injection defense: fields beginning with dangerous spreadsheet triggers (`=`, `+`, `-`, `@`, `\t`, `\r`, `\n`) are sanitized with a leading apostrophe (`'`). Uzbek phone numbers (e.g. `+998901234567`) are safely rendered as text.
  - Monetary values are exported as exact non-negative integer strings without currency symbols or thousands separators. Fractional amounts and unsafe integers are rejected.
  - Consistent empty-dataset policy: when 0 debtors or 0 matching students exist, an RFC 4180-compliant header-only CSV is generated and downloaded, accompanied by accessible user notification.

Run automated frontend unit tests (36 tests) with:
```powershell
node --test .\frontend\tests\api.test.mjs
```

Run real-browser end-to-end integration (15 steps) with:
```powershell
node .\qa\browser-test.mjs
```

## Student API

All endpoints use JSON and are under `http://localhost:8080/api/students`.

| Method | Path | Success | Other important responses |
| --- | --- | --- | --- |
| POST | `/api/students` | 201 Created, with `Location` header | 400 invalid body |
| GET | `/api/students` | 200 array, ordered by ascending ID; `[]` when empty | — |
| GET | `/api/students/{id}` | 200 student | 400 invalid ID; 404 missing student |
| PUT | `/api/students/{id}` | 200 updated student | 400 invalid body or ID; 404 missing student |
| DELETE | `/api/students/{id}` | 204 No Content | 400 invalid ID; 404 missing student; 409 student has payments |

POST and PUT require every field: nonblank `name` (at most 150 characters), nonblank `phone` (at most 30), nonblank `groupName` (at most 100), and positive whole-number `monthlyFee` in UZS. Phone values such as `+998901234567` are accepted. PUT replaces all four editable fields; partial updates are invalid.

Example POST body:

```json
{"name":"Ali Valiyev","phone":"+998901234567","groupName":"English B2","monthlyFee":800000}
```

Example 201 response body (with `Location: http://localhost:8080/api/students/1`):

```json
{"id":1,"name":"Ali Valiyev","phone":"+998901234567","groupName":"English B2","monthlyFee":800000}
```

Errors have `status`, `error`, `message`, and `path`. Validation messages name the invalid fields. A missing student, for example, returns:

```json
{"status":404,"error":"Not Found","message":"Student with ID 999 was not found","path":"/api/students/999"}
```

To try the main CRUD workflow in PowerShell while the backend is running:

```powershell
$base = 'http://localhost:8080/api/students'
$create = @{ name = 'Ali Valiyev'; phone = '+998901234567'; groupName = 'English B2'; monthlyFee = 800000 } | ConvertTo-Json
$student = Invoke-RestMethod -Method Post -Uri $base -ContentType 'application/json' -Body $create
Invoke-RestMethod -Method Get -Uri "$base/$($student.id)"
Invoke-RestMethod -Method Get -Uri $base
$update = @{ name = 'Ali Valiyev'; phone = '+998901234567'; groupName = 'English C1'; monthlyFee = 900000 } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "$base/$($student.id)" -ContentType 'application/json' -Body $update
Invoke-WebRequest -Method Delete -Uri "$base/$($student.id)" | Select-Object StatusCode
```

A student with payment history cannot be deleted. The API returns 409 and retains both the student and payments.

## Payment API

| Method | Path | Success | Other important responses |
| --- | --- | --- | --- |
| POST | `/api/payments` | 201 Created with the saved payment | 400 invalid request; 404 student not found |
| GET | `/api/students/{studentId}/payments` | 200 array, newest date first then highest ID | 400 invalid student ID; 404 student not found |

POST requires a positive `studentId`, a positive whole-number `amount` in UZS, and a valid ISO date (`YYYY-MM-DD`) in `paymentDate`. A student may have multiple independent payments on the same day. Future dates and amounts above the monthly fee are allowed. The API does not combine records or assign them to billing months.

Example POST body:

```json
{"studentId":1,"amount":300000,"paymentDate":"2026-10-21"}
```

Example 201 response body:

```json
{"id":2,"studentId":1,"amount":300000,"paymentDate":"2026-10-21"}
```

Example payment history, ordered by `paymentDate` descending and then `id` descending:

```json
[
  {"id":2,"studentId":1,"amount":300000,"paymentDate":"2026-10-21"},
  {"id":1,"studentId":1,"amount":200000,"paymentDate":"2026-10-05"}
]
```

An existing student with no payments receives `[]`. Validation failures return the same `status`, `error`, `message`, and `path` error structure as the student API.

To verify with a disposable student in PowerShell while the backend is running:

```powershell
$base = 'http://localhost:8080'
$studentBody = @{ name = 'Payment Demo'; phone = '+998901234567'; groupName = 'English B2'; monthlyFee = 800000 } | ConvertTo-Json
$student = Invoke-RestMethod -Method Post -Uri "$base/api/students" -ContentType 'application/json' -Body $studentBody
$first = @{ studentId = $student.id; amount = 200000; paymentDate = '2026-10-05' } | ConvertTo-Json
$second = @{ studentId = $student.id; amount = 300000; paymentDate = '2026-10-21' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/payments" -ContentType 'application/json' -Body $first
Invoke-RestMethod -Method Post -Uri "$base/api/payments" -ContentType 'application/json' -Body $second
Invoke-RestMethod -Method Get -Uri "$base/api/students/$($student.id)/payments"
```

Payment deletion is not part of this API. Remove only your disposable test records directly in PostgreSQL when cleanup is needed, then delete the test student through the student API.

## Monthly debt API

Both `GET /api/debtors?month=YYYY-MM` and the compatibility route `GET /debtors?month=YYYY-MM` return the same JSON. The `month` parameter is required and must contain a four-digit year from `0001` through `9999` and a two-digit month from `01` through `12`. Invalid or missing values return HTTP 400 using the existing `status`, `error`, `message`, and `path` error fields. Both routes use `/api/debtors` as the canonical error path so their JSON remains identical.

For each currently registered student, `paidAmount` sums all payments dated in the requested calendar month. `debt = max(0, monthlyFee - paidAmount)`. Only students with positive debt appear, ordered by ascending `studentId`; HTTP 200 returns `[]` when nobody owes tuition. Each result contains numeric `studentId`, `monthlyFee`, `paidAmount`, and `debt`, plus `name`, `phone`, and `groupName`. Payments on the same date are all counted. The calculation uses the first day of the requested month as an inclusive start and the first day of the following month as an exclusive end.

For example, a student with an 800000 UZS fee and no October payments has `paidAmount: 0` and `debt: 800000`. Two October payments of 200000 and 300000 produce `paidAmount: 500000` and `debt: 300000`. A student who paid 800000 or more does not appear.

Example response for October 2026:

```json
[
  {"studentId":1,"name":"Ali Valiyev","phone":"+998901234567","groupName":"English B2","monthlyFee":800000,"paidAmount":500000,"debt":300000},
  {"studentId":2,"name":"Malika Karimova","phone":"+998911234567","groupName":"Mathematics A1","monthlyFee":600000,"paidAmount":0,"debt":600000}
]
```

The calculation considers every currently registered student for any requested month and uses their *current* monthly fee, including when looking at past months. A payment applies only to the month in its `paymentDate`; excess payments do not carry forward. The system does not track enrollment dates, fee history, invoices, or partial-month tuition. Editing a student's fee can therefore change a previously requested month's calculated balance.

With the backend running, these Windows PowerShell commands check both routes and validation. The payment example above can be used first to create a disposable student with October payments.

```powershell
$base = 'http://localhost:8080'
$primary = Invoke-WebRequest "$base/api/debtors?month=2026-10"
$compatible = Invoke-WebRequest "$base/debtors?month=2026-10"
$primary.StatusCode
$primary.Content
$primary.Content -eq $compatible.Content
$invalid = Invoke-WebRequest -SkipHttpErrorCheck "$base/api/debtors?month=2026-13"
$invalid.StatusCode
$invalid.Content
```

The successful requests return HTTP 200 and identical arrays. The invalid request returns HTTP 400 with `"message":"month must use YYYY-MM format"`.

## Troubleshooting and scope

- If Compose reports that port 5432 is occupied, use the 5433 example above. If 5433 is occupied too, choose another free host port and set the same `DB_PORT` in the backend shell.
- If the backend cannot authenticate to PostgreSQL, confirm that `DB_PASSWORD`, `DB_NAME`, and `DB_USERNAME` match the values used when the named database volume was first created. Changing `.env` does not reset an existing database password.
- If the frontend reports a connection error, check `GET http://localhost:8080/api/health`, then check `frontend/js/config.js`. Serve the frontend over HTTP on port 5500; opening `index.html` with `file://` will not work.
- If the browser reports CORS errors, use `http://127.0.0.1:5500` or `http://localhost:5500`. The backend allows those two development origins. CORS does not authenticate callers.
- The frontend displays an error when an API monetary number exceeds JavaScript's safe-integer range. It accepts positive whole UZS payments up to 9,007,199,254,740,991; the backend can accept larger `Long` values through direct API clients. Do not treat an unsafe browser number as an exact amount.
- This assignment has no login, roles, or payment-correction API. Run it on a trusted local machine; the development server and database settings are not production deployment guidance.

## What I Would Improve With One More Week

1. Add authentication and role-based access for staff who view or record financial data.
2. Track tuition fee history and enrollment periods so old monthly balances remain stable after a fee change.
3. Add automated PostgreSQL integration tests in an isolated database to cover migrations, constraints, and concurrent requests.
4. Add audited payment corrections with explicit reversal records instead of deleting financial history.
5. Add searchable financial reports and filters for staff review.
