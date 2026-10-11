---
id: bjadnm
name: Headless claude -p run: the file-rule finding is never written to the session log (2 runs logged nothing, 1 run logged 'the review of the main session turn failed')
type: bug
status: pending
parentId: ye84t5
dependsOn: []
---
- 2026-10-12T13:59:09.943Z — Re-evaluated 2026-10-12, 3 headless runs (claude -p --output-format stream-json, acceptEdits, also with --allowedTools 'Edit(src/**)'): with cc-enforcer loaded every Edit to src/util.ts was refused with 'Claude requested permissions to edit .../src/util.ts which is a sensitive file', so no edit ran and no finding was written to the session log in any run. Control run of the same prompt without --plugin-dir edited the file normally. Interactively the same plugin-induced edit permission prompt appears even in acceptEdits mode.
