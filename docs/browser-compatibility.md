# Browser Compatibility Matrix

| Browser        | Build target     | Status                   | Notes                                                                 |
| -------------- | ---------------- | ------------------------ | --------------------------------------------------------------------- |
| Chrome         | WXT MV3 `chrome` | Implemented              | Uses `activeTab`, `scripting`, IndexedDB, action popup, options page. |
| Microsoft Edge | WXT MV3 `edge`   | Implemented build target | Same MV3 APIs as Chrome for MVP; validate before store submission.    |

Unsupported API fallback strategy:

- Page reading happens after explicit user click. If `browser.scripting` is unavailable, show a clear error and allow manual entry.
- Sync queue is durable in IndexedDB, so suspended background workers can resume on the next alarm or UI open.
- External sync failure never blocks local save.
