---
id: fbrmw6
name: Session log files are created world-readable (-rw-r--r--), not owner-only
type: bug
status: pending
parentId: ygxah1
dependsOn: []
---
- 2026-10-12T11:03:12.429Z — gk1y3n: denied git push --force origin SECRET123 in an interactive session; log ~/.cc-enforcer/logs/<sid>.jsonl had rule name/action/event/tool and no SECRET123, but stat showed -rw-r--r-- (dir drwxr-xr-x) in 2 of 2 completed runs.
- 2026-10-12T11:46:35.905Z — Re-eval 2026-10-12: no longer reproduces. Session logs under ~/.cc-enforcer/logs are now -rw------- (owner-only) in every run observed.
