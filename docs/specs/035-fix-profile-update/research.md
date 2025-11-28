# Research: Fix Profile Update Silent Failure

## Research Questions

### Q1: Why does Supabase .update() return error:null when 0 rows updated?

**Decision**: This is expected PostgreSQL/Supabase behavior - UPDATE returns success when the query executes successfully, regardless of whether rows were affected.

**Rationale**: PostgreSQL considers "0 rows updated" a successful operation (no error occurred). The UPDATE statement executed correctly; it just matched no rows. Supabase follows this behavior.

**Alternatives Considered**:

- Check `count` property (not reliably returned by all Supabase operations)
- Use `.select()` to get returned data and verify it exists

### Q2: Should we use .update() with validation or .upsert()?

**Decision**: Use `.upsert()` with `onConflict: 'id'`

**Rationale**:

1. **Handles missing rows**: If user_profiles row doesn't exist (trigger failed on signup), upsert creates it
2. **Atomic operation**: Single database call vs update + check + potential insert
3. **Returns data**: With `.select().single()`, we get the updated row back to verify success
4. **RLS compatible**: Works with existing UPDATE RLS policy

**Alternatives Considered**:

- `.update().select()` - fails if row doesn't exist
- Check row exists first, then update - race condition risk, 2 DB calls

### Q3: How should username case be handled?

**Decision**: Normalize to lowercase on save, keep validation check as-is

**Rationale**:

1. `checkUsernameAvailable()` already checks lowercase (line 112)
2. Save should match what we check: `username.trim().toLowerCase()`
3. Display can show original case (display_name field)
4. Database UNIQUE constraint is case-sensitive, so normalization prevents "john" vs "John" duplicates

**Alternatives Considered**:

- Keep original case, change validation - breaks existing users with lowercase usernames
- Database-level CITEXT column - requires migration, overkill for this fix

### Q4: What should the error message be when data is null?

**Decision**: "Profile update failed - please try again."

**Rationale**: Generic but actionable. Don't expose internal details (RLS, missing row) to users.

**Alternatives Considered**:

- "Your profile may need to be re-created" - too confusing
- Silent retry - could cause infinite loops

## Key Findings

1. **Root Cause Confirmed**: `.update()` returns `error: null` because PostgreSQL treats "0 rows affected" as success
2. **Fix Verified**: `.upsert()` with `onConflict` is the correct pattern for Supabase when row may not exist
3. **Case Normalization**: Username should be lowercase to match existing availability check
4. **Success Validation**: Must check returned `data` exists, not just `!error`

## References

- Supabase docs: https://supabase.com/docs/reference/javascript/upsert
- PostgreSQL UPDATE: Returns number of rows, 0 is not an error
- Existing code: `src/lib/profile/validation.ts:112` uses `.toLowerCase()`
