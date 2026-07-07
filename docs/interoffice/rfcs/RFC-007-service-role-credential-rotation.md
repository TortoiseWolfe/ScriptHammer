# RFC-007: Service Role Credential Rotation Policy

**Status**: decided
**Author**: Security Lead
**Created**: 2026-01-15
**Target Decision**: 2026-01-17
**Source**: Security Audit `docs/interoffice/audits/2026-01-15-security-000-rls-audit.md` (SEC-000-003)

## Stakeholders (Consensus Required)

| Stakeholder   | Vote        | Date       |
| ------------- | ----------- | ---------- |
| CTO           | **approve** | 2026-01-15 |
| Architect     | **approve** | 2026-01-15 |
| Security Lead | **approve** | 2026-01-15 |
| Toolsmith     | **approve** | 2026-01-15 |
| DevOps        | **approve** | 2026-01-15 |
| ProductOwner  | **approve** | 2026-01-15 |

**Votes**: approve | reject | abstain
**Required for Decision**: All non-abstaining stakeholders must approve

## Summary

This RFC proposes adding credential rotation requirements for the Supabase service role to Feature 000 (RLS). The service role has full database access, bypassing all RLS policies. Without rotation procedures, a compromised credential provides indefinite access to all user data.

## Motivation

### The Risk

The service role (`service_role` key in Supabase) is the most privileged credential in the system:

- Bypasses ALL Row Level Security policies
- Can read, modify, and delete ANY data in ANY table
- Required for backend operations (webhooks, notifications, cleanup jobs)

**Current State**: Feature 000 spec requires:

- FR-011: Service role bypass for backend operations
- FR-012: Audit logging of service role usage
- FR-013: Minimize scope to necessary operations
- FR-014: Never expose to client-side code

**Gap**: No requirement for credential rotation or compromise response.

### Attack Scenarios

**Scenario 1: Credential Leak via Logs**

1. Developer accidentally logs request headers including service role key
2. Logs shipped to third-party monitoring service
3. Monitoring service is breached months later
4. Attacker has valid service role credential

**Scenario 2: Developer Workstation Compromise**

1. Developer has service role key in local `.env` file
2. Workstation compromised via phishing
3. Attacker extracts `.env` files
4. Service role credential provides full database access

**Scenario 3: Supply Chain Attack**

1. Malicious dependency added to project
2. Dependency exfiltrates environment variables on build
3. Service role key sent to attacker's server

### Why Rotation Matters

- **Limits exposure window**: Rotated credentials expire attacker access
- **Compliance requirement**: SOC 2, PCI-DSS require credential rotation
- **Defense in depth**: Even if compromise goes undetected, rotation limits damage
- **Incident response**: Documented procedures enable rapid response

## Proposal

### Add to Feature 000 spec.md

**Non-Functional Requirements - Credential Management**

```markdown
- **NFR-014**: Service role credentials MUST be rotated on a defined schedule (minimum quarterly)
- **NFR-015**: Service role credentials MUST be rotated immediately upon suspected compromise
- **NFR-016**: Credential rotation MUST NOT cause service interruption (zero-downtime rotation)
- **NFR-017**: Previous credentials MUST be revoked within 24 hours of rotation
- **NFR-018**: Credential rotation events MUST be logged in the security audit trail
```

**Edge Cases (add to existing section)**

```markdown
- What happens when service role credentials are compromised?
  → Immediate rotation via documented runbook, audit log review for unauthorized access,
  incident report filed, affected users notified if data accessed
```

### Create Credential Rotation Runbook

Location: `docs/runbooks/service-role-rotation.md`

```markdown
# Service Role Credential Rotation Runbook

## Scheduled Rotation (Quarterly)

1. Generate new service role key in Supabase dashboard
2. Update GitHub Secrets with new key
3. Deploy to staging, verify backend operations
4. Deploy to production
5. Revoke old key in Supabase dashboard (after 24hr grace period)
6. Log rotation in audit trail

## Emergency Rotation (Suspected Compromise)

1. IMMEDIATELY generate new service role key
2. Update GitHub Secrets
3. Deploy to production (skip staging)
4. IMMEDIATELY revoke old key (no grace period)
5. Review audit logs for unauthorized access
6. File incident report
7. Notify affected users if data accessed

## Verification Checklist

- [ ] New key works in staging
- [ ] New key works in production
- [ ] Old key is revoked
- [ ] Audit log entry created
- [ ] No service interruption observed
```

### Implementation Notes

**Supabase Credential Rotation**:

- Supabase allows multiple active service role keys
- Generate new key → deploy → revoke old key = zero downtime
- Keys managed in Project Settings → API

**GitHub Secrets Update**:

- Update `SUPABASE_SERVICE_ROLE_KEY` secret
- Re-run deployment workflow to pick up new value

**Monitoring**:

- Alert on service role usage from unexpected IPs
- Alert on service role usage outside business hours
- Review service role audit logs weekly

## Alternatives Considered

### Alternative A: Annual Rotation Only

Rotate credentials once per year instead of quarterly.

**Pros**:

- Less operational overhead
- Fewer deployment risks

**Cons**:

- 365-day exposure window if compromised
- Does not meet SOC 2 / PCI-DSS recommendations
- Industry standard is 90 days or less

**Verdict**: Rejected. Quarterly is the minimum acceptable frequency.

### Alternative B: Automated Rotation via Vault

Use HashiCorp Vault or AWS Secrets Manager for automated credential rotation.

**Pros**:

- Fully automated, no manual steps
- Shorter rotation intervals possible (weekly/daily)
- Centralized secret management

**Cons**:

- Adds infrastructure complexity
- Supabase doesn't natively integrate with Vault
- Over-engineered for current scale (1,000-10,000 users)

**Verdict**: Deferred. Consider when scaling beyond 100,000 users.

### Alternative C: No Rotation Policy

Rely on other security controls (audit logging, IP restrictions) without rotation.

**Pros**:

- Zero operational overhead

**Cons**:

- Single point of failure if credential leaks
- Does not meet compliance requirements
- Violates defense-in-depth principle

**Verdict**: Rejected. Rotation is a fundamental security control.

## Impact Assessment

| Area             | Impact                               | Mitigation                 |
| ---------------- | ------------------------------------ | -------------------------- |
| Feature 000 Spec | Add 5 NFRs (NFR-014 to NFR-018)      | Minor edit                 |
| Documentation    | Create rotation runbook              | One-time effort            |
| Operations       | Quarterly rotation task              | ~30 minutes per quarter    |
| DevOps           | Update deployment for secret refresh | Existing workflow supports |
| Compliance       | Meets SOC 2 / PCI-DSS requirements   | Positive impact            |

## Discussion Thread

### Security Lead - 2026-01-15 - Initial Proposal

This finding emerged from the RLS security audit. The service role is intentionally powerful - it MUST bypass RLS for legitimate backend operations. This makes it the highest-value target for attackers.

Current mitigations (audit logging, scope minimization, no client exposure) are necessary but not sufficient. Rotation provides a time-bound limit on credential compromise:

| Rotation Frequency | Maximum Exposure Window |
| ------------------ | ----------------------- |
| Never              | Indefinite              |
| Annual             | 365 days                |
| Quarterly          | 90 days                 |
| Monthly            | 30 days                 |

Quarterly rotation balances security (90-day max exposure) with operational burden (~2 hours/year).

The runbook ensures rotation is repeatable and testable. Zero-downtime rotation is achievable because Supabase supports multiple active keys.

I recommend approval. This is a low-effort, high-impact security improvement.

### CTO (2026-01-15) - Vote: APPROVE

This is fundamental security hygiene that should have been in the original spec.

1. **Service role is the keys to the kingdom** - It bypasses all RLS. A leaked credential is a complete data breach. Rotation limits blast radius.

2. **Quarterly is the right cadence** - Monthly is excessive overhead for our scale. Annual is negligent. 90-day rotation is industry standard (SOC 2, PCI-DSS).

3. **Runbook is essential** - Documented procedures ensure rotation happens correctly under pressure. Emergency rotation during an incident is not the time to improvise.

4. **Zero-downtime rotation** - The approach (multiple active keys) is sound. No excuse not to implement.

Approved. Add to P0 scope since it affects Feature 000 (RLS).

## Dissent Log

| Stakeholder | Objection | Response |
| ----------- | --------- | -------- |
| -           | -         | -        |

## Decision Record

**Decided**: 2026-01-15
**Outcome**: APPROVED (6-0 unanimous)
**Decision ID**: DEC-008

Service role credential rotation policy (NFR-014-018) approved. Create rotation runbook at `docs/runbooks/service-role-rotation.md`. Add to P0 scope.
