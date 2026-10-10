---
id: lsoutl
name: f97ych: no way to run an authenticated Claude Code session with a temporary HOME/personal folder
type: gap
status: pending
parentId: ygxah1
dependsOn: []
---
- 2026-10-12T11:03:12.520Z — Tried HOME=<fixture>/home and CLAUDE_CONFIG_DIR=<fixture>/home/.claude: both sessions start but show 'Not logged in · Run /login'. Also blocks p05lnv (project + personal rules both apply) and 3z23vb (personal folder never loaded twice as project).
- 2026-10-12T11:34:31.608Z — Re-eval 2026-10-12: same lever also blocks 3z23vb and p05lnv (and f97ych again). Interactive claude with HOME=<fixture>/home stops at first-run onboarding (theme picker, then 'Select login method'), so no authenticated session with a temporary personal folder can be started without writing to the real ~/.claude.
