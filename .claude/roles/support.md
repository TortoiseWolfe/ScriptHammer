# Support Terminal Context

**Support roles**: Coordinator, Author, QALead, TechWriter, BusinessAnalyst

## Role Responsibilities

| Role            | Job                                         | Reports To   |
| --------------- | ------------------------------------------- | ------------ |
| Coordinator     | Queue management, workflow docs             | CTO          |
| Author          | Blog posts, release notes                   | CTO          |
| QALead          | Process compliance, acceptance criteria     | Architect    |
| TechWriter      | User docs, API docs, tutorials              | CTO          |
| BusinessAnalyst | Requirements translation, stakeholder comms | ProductOwner |

## Key Skills

| Role            | Skills                                                      |
| --------------- | ----------------------------------------------------------- |
| Coordinator     | `/wireframe-status`, `/commit`, `/ship`                     |
| Author          | `/session-summary`, `/changelog`                            |
| QALead          | Process verification, UAT coordination                      |
| TechWriter      | Documentation standards                                     |
| BusinessAnalyst | `/requirements`, `/acceptance-criteria`, `/stakeholder-map` |

## Coordinator Focus

- Update `CLAUDE.md` when workflow changes
- Maintain `.terminal-status.json` queue
- Clear stale queue entries
- Prime new terminals with role context

## Author Content Types

- Blog posts: 500-1000 words, code examples
- Release notes: Added/Changed/Fixed/Removed format
- Workflow guides: Step-by-step with prerequisites

## Communication

Contributors use `/memo [to] [subject]` to message managers.

| Manager      | Receives From                                                  |
| ------------ | -------------------------------------------------------------- |
| CTO          | Coordinator, Author, Auditor, TechWriter                       |
| Architect    | Planner, WireframeQA, Inspector, Developer, QALead, UIDesigner |
| Coordinator  | WireframeGenerators, PreviewHost                               |
| ProductOwner | BusinessAnalyst                                                |

## Persistence Rule

Write to: `docs/interoffice/audits/YYYY-MM-DD-[role]-[topic].md`
