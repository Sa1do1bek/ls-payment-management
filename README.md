# Educational Center Payment Management

This repository contains the Task 1 foundation of an educational center payment management system. Task 1.1 separates the backend and future frontend. Student and payment operations, and the frontend itself, belong to later tasks.

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

From `backend/`, run `.\mvnw.cmd test` for the health endpoint smoke test or `.\mvnw.cmd clean verify` to compile, test, and package the backend. The smoke test uses MockMvc and needs no database. Database migration and JPA validation run against PostgreSQL when the backend starts.

With the backend running, open another PowerShell window and run:

```powershell
$response = Invoke-WebRequest http://localhost:8080/api/health
$response.StatusCode
$response.Content
```

The expected result is HTTP 200 with `{"status":"UP"}`.
