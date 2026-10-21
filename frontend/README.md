# Frontend

This independent HTML5, Bootstrap 5, and Vanilla JavaScript interface displays monthly debtors and records payments through the existing Spring Boot API. No frontend build step or package installation is required.

## Run locally on Windows PowerShell

Start PostgreSQL and the backend as described in the [root README](../README.md). In a separate PowerShell window at the repository root, start the included static HTTP server:

```powershell
node .\frontend\serve.mjs
```

Open `http://127.0.0.1:5500` in a browser. Do not open `index.html` through `file://`; browser module imports and API requests need an HTTP origin. The static server binds only to the local machine. Bootstrap 5.3.3 styles load from a pinned CDN URL, so the browser needs internet access for those styles.

The API base URL is defined once in `js/config.js` and defaults to `http://localhost:8080`. Change it there if the backend runs on a different host or port. The backend permits CORS requests from `http://127.0.0.1:5500` and `http://localhost:5500` for the frontend's GET and POST operations. CORS is a browser policy, not authentication for other clients.

## Use and verification

The report defaults to the browser's local current month. Choose another month or select **Refresh report** to reload it. The page shows every student with positive debt, a debtor count, and an exact total. The payment selector includes all students, even those who have paid in full. A successful payment refreshes the selected report; the payment date can belong to a different month.

The amount field accepts positive whole UZS through JavaScript's maximum safe integer, 9,007,199,254,740,991. Larger values are blocked to prevent rounding in the browser; the backend's full `Long` range remains available to API clients. API monetary values outside the browser's safe-integer range produce an error instead of an inaccurately rounded display. Report totals use `BigInt` to avoid overflow when adding safe individual debts.

From `backend/`, run `.\mvnw.cmd clean verify` for backend and CORS tests. From the repository root, run `node --test .\frontend\tests\api.test.mjs` for Fetch API response handling tests. To inspect frontend behavior, open the page in a browser and try an empty student list, select a reporting month, record a payment, and check the balance again. For a mobile layout, use browser device emulation near 375px wide.

If the page reports that it cannot connect, verify that PostgreSQL and Spring Boot are running, and check `js/config.js`. If the browser console reports a CORS error, serve the page from port 5500 on `localhost` or `127.0.0.1` and confirm the backend is running with the current CORS configuration. An unexpected server response is displayed as an error rather than an empty report.
