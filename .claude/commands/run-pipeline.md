---
description: "Run the autonomous orchestrator pipeline: pick the highest-priority open ticket and chain context-manager → semantic-analyzer → architect → senior-developer → tester → audit-manager, halting only at user-reserved merge/push gates."
---

Start the development pipeline. Spawn the `orchestrator` agent and execute its full sequence:

1. Briefing via context-manager
2. Branch setup
3. Analysis via semantic-analyzer
4. Architect plan (backend or frontend depending on scope)
5. Implementation via senior-developer
6. Tests via tester
7. Audit via audit-manager
8. Stop at user handoff — report READY FOR PR

Do not merge. Do not push. Do not skip any gate.
