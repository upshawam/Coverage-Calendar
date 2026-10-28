# Test Nonnie availability calendar

The GitHub Pages app already displays date-keyed shift entries such as `{ person: "Nonnie", category: "N-Available" }`. A temporary browser test confirmed the label renders. The remaining setup is in the existing Google Apps Script project behind `SHEETS_URL`.

## One-time setup

1. Create a dedicated Google Calendar named `Nonnie Childcare` and share it with Nonnie's Google account as an editor.
2. Add that same Google account to the iPhone under **Settings > Calendar > Accounts > Add Account > Google**. Enable Calendar sync and make sure `Nonnie Childcare` is checked in the Calendar app.
3. In the Apps Script project that serves `SHEETS_URL`, paste the contents of `nonnie-calendar-integration.gs.txt` into the project.
4. Open **Project Settings > Script Properties** and add `NONNIE_CALENDAR_ID` with the calendar's ID. Use the calendar's ID, not its public or secret iCal URL.
5. In the existing `doGet`, after it has built the date-keyed `out` object and before it serializes the response, call:

   ```javascript
   appendNonnieAvailability(out);
   ```

6. Save and update the existing Apps Script web app deployment. Keep its current access setting so GitHub Pages can fetch the JSON.

## Add or change availability

Nonnie creates an **all-day** event titled exactly `Available` on each day she can watch the kids. She can edit or delete those events as plans change. Other titles and timed events are ignored. Multi-day all-day events mark each included day; the calendar's exclusive end date is not included.

## End-to-end test

1. Create an all-day `Available` event a few days in the future.
2. Refresh the GitHub Pages calendar. The date should show `N-Available`.
3. Move the event to another day or delete it, then refresh again. The old date should lose the label and the new date should gain it.
4. Confirm other shift labels on those dates remain present.

The endpoint reads the calendar on each request, so there is no separate sheet trigger to wait for. Google/iPhone calendar synchronization can still introduce a short delay before the event is visible to Apps Script.
