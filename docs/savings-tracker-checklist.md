# Savings Tracker: local testing and backup

The Savings Tracker stores data only in this browser profile under `campusbridge.savings-tracker.v1`. It does not require a Supabase project, database table, RLS policy, MFA enrollment, or SQL. This checklist does not change the setup required by unrelated Supabase authentication and cloud-plan features.

## Try the tracker

1. Start the site from the project folder with `npx vercel dev` or use the static server described in the README. No tracker login is required.
2. Open the Financial Planner, enter valid details, calculate a plan, then choose **Save Roadmap** and give it a name.
3. Open **Savings Tracker** from the site navigation. The saved roadmap should appear. Open it and check that the funding goal, saved calculation time, rate details, and contribution schedule describe the historical snapshot.
4. Record a positive BDT deposit dated on or after the roadmap calculation date. Check that total saved, remaining gap, percentage, charts, and history update. Edit the deposit and confirm the history and totals update; delete it only after the confirmation prompt.
5. Refresh the page. The roadmap and deposit should remain in the same browser profile.
6. Choose **Export backup** and save the JSON file somewhere you control. It contains personal financial planning inputs and student-entered deposit notes; protect it like a private document.
7. To test restore, first export a backup of the current data. Add or change a tracker item, then choose **Import backup** and select the earlier CampusBridge tracker JSON file. Confirm replacement. The earlier data should be restored. Cancel the confirmation once to verify the current data remains unchanged.
8. Try importing a malformed JSON file or a JSON file with an unsupported format/version. The page should show an error and leave current data unchanged.
9. Use **Recalculate revised plan** to create a revised snapshot. Confirm the original roadmap remains available and historical results stay unchanged. New deposits are attached to the selected roadmap.

## Limits and recovery

- Data stays in the current browser profile on this device. It is not synced to accounts, other browsers, or other devices.
- Clearing site data, using a private window, or browser storage restrictions can remove or prevent local data. Export backups regularly.
- Importing a valid backup replaces all tracker data in this browser after confirmation. Export first if you want a recovery point.
- Imported JSON is parsed as data, checked against the supported format/version and the deterministic finance engine, and never executed as code or HTML.
- Historical calculation snapshots are explanatory saved results, not verified financial records. Deposits are student-entered, not bank-verified.
- Browser unit tests do not simulate every browser's local-storage quota, privacy mode, download behavior, or file picker. Check those behaviors manually in the browser you use.

## Old database setup file

`supabase-savings-tracker.sql` is a legacy proposal from the earlier cloud-backed tracker. The current local-browser Savings Tracker does not need it. Do not run it for this feature. The separate `supabase-mfa-rls.sql` concerns the unrelated cloud-saved planner feature and remains a separate review/setup matter.
