# Educational Center Payment Management

This repository contains the backend foundation, student management API, and payment recording/history API for an educational center payment management system. Monthly debt calculations and the frontend belong to later tasks.

## Project structure

```text
payment-management/
├── backend/              Spring Boot application, Maven Wrapper, Flyway, tests
├── frontend/             Placeholder documentation for Task 5
├── docker-compose.yml    Local PostgreSQL
├── .env.example           Safe local configuration example
├── .gitignore
└── README.md
```

The backend uses Java 21, Spring Boot 3.5.16, Spring Web, Spring Data JPA / Hibernate, Jakarta Bean Validation, Flyway, and JUnit 5. PostgreSQL runs from the 17 Alpine image. The frontend will use HTML5, Bootstrap 5, and Vanilla JavaScript when Task 5 begins.

## Prerequisites

Install Java 21 and Docker with the Compose plugin. The Maven Wrapper downloads Maven 3.9.11 automatically on its first run.

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

## Test and verify

From `backend/`, run `.\mvnw.cmd test` for the automated health, student, and payment tests or `.\mvnw.cmd clean verify` to compile, test, and package the backend. These tests use MockMvc and Mockito and need no database. Database migration and JPA validation run against PostgreSQL when the backend starts.

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
