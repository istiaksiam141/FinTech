# Test Results

## Automated test run

- **Command:** `node --test "tests/*.test.cjs"`
- **Run started:** 20 October 2026, 03:06:30.161 (`Asia/Dhaka`, UTC+06:00)
- **Run ended:** 20 October 2026, 03:06:39.199 (`Asia/Dhaka`, UTC+06:00)
- **Repository:** branch `main`, commit `5a5c5e969e9e3a7d7aa6709554c4f46704c690a2`
- **Working tree:** pre-existing changes were documentation-only; no app source was changed for this evidence package.
- **Runtime:** Node.js v24.21.0; npm v11.19.0.
- **Exit code:** 0.
- **Blocked tests:** 0 were reported by the Node runner. Live account/sandbox checks listed in `test-cases.md` were not executed tests and remain unverified, rather than being counted as passing.

```text
tests 175
suites 0
pass 175
fail 0
cancelled 0
skipped 0
todo 0
```

Full Node test-run output: [test-output.txt](test-output.txt). Captured timestamps and exit code: [test-run-metadata.txt](test-run-metadata.txt). No test failures were observed. The suite is local and uses fixtures/stubs for external systems; it does not prove production configuration or live database policies.

## Whitespace check

- **Command:** `git diff --check`
- **Run:** 20 October 2026, 03:10:05.439–03:10:05.838 (`Asia/Dhaka`, UTC+06:00); passed after the evidence files were complete.
- **Result:** passed with no whitespace errors. Git may print working-copy LF-to-CRLF notices for existing Markdown files; those are line-ending notices, not whitespace failures.

The command checks tracked diffs. New evidence Markdown was also checked for trailing whitespace before completion.

## Test grouping

The test suite covers finance formulas, currency conversion, input limits, schedules, quote eligibility/ranking, Bangladesh Bank parsing and cache/retry/stale handling, assistant routing and request limits, saved-chat consent and ownership checks, plan and local storage, cloud-plan client calls, auth-state/MFA flows, and page structure. See the filenames under `tests/` and the full output file for individual test names.

No `npm test` command was used; `package.json` defines no test script. No dependencies were installed during this evidence run.
