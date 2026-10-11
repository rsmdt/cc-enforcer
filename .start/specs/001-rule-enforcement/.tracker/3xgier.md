---
id: 3xgier
name: Interrupting a turn and submitting a new prompt reviews the queued call and shows its finding instead of telling the user the queued calls were not reviewed
type: bug
status: pending
parentId: ye84t5
dependsOn: []
---
- 2026-10-12T13:59:14.478Z — 2 interactive runs: rule doc-public-fn (warn, llm_evaluate). Prompt: add exported divide() then run 'ping -c 60 127.0.0.1' in foreground; approved edit; pressed Esc during ping; submitted 'Say hi.'. Output showed 'review flagged Edit ... divide' right after the new prompt and in the band; no message said queued calls were not reviewed.
