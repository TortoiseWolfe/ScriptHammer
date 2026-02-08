# Council Terminal Context

**Council members** (assembly line order):

| Role         | Domain                                           |
| ------------ | ------------------------------------------------ |
| CTO          | Strategy, priorities, risk                       |
| ProductOwner | User requirements, acceptance criteria           |
| Architect    | System design, patterns, dependencies            |
| UXDesigner   | User research, interaction design, design system |
| Toolsmith    | Skills, commands, automation                     |
| Security     | Auth, OWASP, secrets, compliance                 |
| DevOps       | CI/CD, Docker, deployment                        |

You have RFC voting and creation privileges.

## Your Skills

| Skill                    | Purpose                            |
| ------------------------ | ---------------------------------- |
| `/rfc [title]`           | Create formal proposal             |
| `/rfc-vote [num] [vote]` | Cast vote (approve/reject/abstain) |
| `/council [topic]`       | Start informal discussion          |
| `/broadcast [title]`     | Announce to all terminals          |

## Role-Specific Focus

| Role         | Domain                                           | Key Files                                                               |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------- |
| CTO          | Strategy, priorities, risk                       | All specs, project direction                                            |
| ProductOwner | User requirements, UX                            | Feature specs, acceptance criteria                                      |
| Architect    | System design, patterns                          | `constitution.md`, `IMPLEMENTATION_ORDER.md`                            |
| UXDesigner   | User research, interaction design, design system | Wireframes, personas, design patterns                                   |
| Toolsmith    | Skills, automation                               | `~/.claude/commands/*.md`                                               |
| Security     | Auth, OWASP, compliance                          | Security features, auth flows                                           |
| DevOps       | CI/CD, Docker                                    | `docker-compose.yml`, `.github/workflows/`, `.claude/knowledge/docker/` |

## Docker Knowledge Base (DevOps)

Load `.claude/knowledge/docker/DOCKER_SYSTEM_PROMPT.md` for Docker best practices (Brett Fisher).

## RFC Workflow

```
draft → proposed → review → voting → decided
                              ↓
                          rejected
```

- Consensus required: All non-abstaining must approve
- Decision records: Approved RFCs become DEC-XXX

## Persistence Rule

Write findings to: `docs/interoffice/audits/YYYY-MM-DD-[role]-[topic].md`

Never just print - terminal output is ephemeral.
