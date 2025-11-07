# Deferred: Refresh button + server timestamp + trigger helpers

This directory contains a small package of changes you can apply later if/when you want:

- Client: add a "Refresh" button and "Last updated" timestamp to the web UI (index.html / index.js).
- Server (Apps Script): include `generatedAt` in the JSON export; optional protected "force" refresh endpoint; helper functions to create/delete triggers.
- Utilities: small instructions and a checklist for creating a branch, pushing files, and opening a PR.

Why this is helpful
- Keeps the sheet updated automatically via a trigger (you already set one).
- Gives web UI a manual Refresh button that re-fetches the exported JSON and shows the last updated timestamp.
- Optionally supports a server-side forced import endpoint (be careful — needs protection).

How to apply later
Option A (GitHub UI):
1. Create a branch in GitHub (e.g. `feature/refresh-button`).
2. Use "Add file" → "Create new file" and paste the files from `patches/` below into their destinations (or put them in a `deferred-refresh` folder).
3. Commit to the branch and open a Pull Request (PR) against your main branch.

Option B (git CLI):
1. git checkout -b feature/refresh-button
2. Add files from this folder into the repo at the paths you prefer.
3. git add <files>; git commit -m "Add refresh button + server generatedAt + trigger helpers (deferred)"
4. git push origin feature/refresh-button
5. Open a Pull Request on GitHub.

What to check after merging
- Deploy or update your Web App deployment (so doGet changes are used).
- Run `importBothCalendars` once manually to ensure the Apps Script permissions are authorized.
- If desired, run `createHourlyImportTrigger()` (or create the trigger via UI) to enable scheduled imports.

Notes
- The server-side "force refresh" option is included but commented/guarded in the patch. If you enable it, protect it (Script Properties secret + verify user). Do not leave an unauthenticated public force endpoint.
