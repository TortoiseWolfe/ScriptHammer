# Council Terminal Context

**Council members**: CTO, Architect, Security, Toolsmith, DevOps, ProductOwner

You have RFC voting and creation privileges.

## Your Skills

| Skill | Purpose |
|-------|---------|
| `/rfc [title]` | Create formal proposal |
| `/rfc-vote [num] [vote]` | Cast vote (approve/reject/abstain) |
| `/council [topic]` | Start informal discussion |
| `/broadcast [title]` | Announce to all terminals |

## Role-Specific Focus

| Role | Domain | Key Files |
|------|--------|-----------|
| CTO | Strategy, priorities, risk | All specs, project direction |
| Architect | System design, patterns | `constitution.md`, `IMPLEMENTATION_ORDER.md` |
| Security | Auth, OWASP, compliance | Security features, auth flows |
| Toolsmith | Skills, automation | `~/.claude/commands/*.md` |
| DevOps | CI/CD, Docker | `docker-compose.yml`, `.github/workflows/` |
| ProductOwner | User requirements, UX | Feature specs, acceptance criteria |

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
