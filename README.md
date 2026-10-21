# Educational Center Payment Management

This repository contains the Spring Boot API and an independent frontend for managing payments and viewing monthly tuition debts.

## Project structure

```text
payment-management/
├── backend/              Spring Boot application, Maven Wrapper, Flyway, tests
├── frontend/             HTML5, Bootstrap 5, Vanilla JavaScript, local static server
├── docker-compose.yml    Local PostgreSQL
├── .env.example           Safe local configuration example
├── .gitignore
└── README.md
```

The backend uses Java 21, Spring Boot 3.5.16, Spring Web, Spring Data JPA / Hibernate, Jakarta Bean Validation, Flyway, and JUnit 5. PostgreSQL runs from the 17 Alpine image. The frontend uses HTML5, CSS3, Bootstrap 5.3.3, and Vanilla JavaScript modules, with no bundler.

## Prerequisites

Install Java 21, Node.js, and Docker with the Compose plugin. The Maven Wrapper downloads Maven 3.9.11 automatically on its first run. Node.js serves the independent frontend without any package installation.

## Set up and run on Windows PowerShell

Run these commands from the repository root:

```powershell
Copy-Item .env.example .env
$env:DB_PASSWORD = 'change-me-for-local-development'
docker compose up -d --wait
cd backend
.\mvnw.cmd clean verify
.\mvnw.cmd spring-boot:run
```

The example password is for a disposable local database. Use a different secret in shared environments. Docker Compose reads the root `.env` file; Spring Boot reads `DB_PASSWORD` from the shell. If you edit database values in `.env`, set matching shell variables before running the backend. `DB_HOST`, `DB_PORT`, `DB_NAME`, and `DB_USERNAME` can override the backend defaults. The default database address is `localhost:5432/payment_management`.

If port 5432 is already in use, change `DB_PORT` to `5433` in the root `.env` file and run `$env:DB_PORT = '5433'` before starting Compose and Spring Boot. Run `docker compose down` from the repository root to stop PostgreSQL without deleting its named volume.

Flyway applies `backend/src/main/resources/db/migration/V1__create_students_and_payments.sql` when the backend starts. Hibernate validates the mapped schema; it does not create or update tables.

In a second PowerShell window at the repository root, serve the frontend and open the shown URL:

```powershell
node .\frontend\serve.mjs
```

Open `http://127.0.0.1:5500` in your browser. The frontend calls the backend at `http://localhost:8080`, configured in `frontend/js/config.js`. The backend allows the documented local frontend origins (`localhost:5500` and `127.0.0.1:5500`) to make GET and POST requests. The pinned Bootstrap CDN stylesheet requires internet access. Do not use `file://` to open the page.

## Test and verify

From `backend/`, run `.\mvnw.cmd test` for the automated health, student, payment, debtor, and CORS tests or `.\mvnw.cmd clean verify` to compile, test, and package the backend. These tests use MockMvc and Mockito and need no database. From the repository root, run `node --test .\frontend\tests\api.test.mjs` for frontend API handling tests. Database migration and JPA validation run against PostgreSQL when the backend starts. Browser verification requires both servers running.

With the backend running, open another PowerShell window and run:

```powershell
$response = Invoke-WebRequest http://localhost:8080/api/health
$response.StatusCode
$response.Content
```

The expected result is HTTP 200 with `{"status":"UP"}`.

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
