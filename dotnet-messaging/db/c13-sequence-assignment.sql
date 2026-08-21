-- C13 — message sequence assignment, owned by the .NET backend.
--
-- WHY THIS FILE EXISTS. Until now the .NET server owned no schema at all: it inserts
-- `sequence_number = 0` (ConversationsController.cs) and relied on Supabase's
-- BEFORE-INSERT trigger to overwrite it. That works only while the two backends share
-- one Postgres. On the clean-room database #265 is aiming at, the trigger is absent,
-- every insert lands 0, and the SECOND message in any conversation violates
-- `unique_sequence`. See tests/rls/dotnet-sequence-assignment.test.ts, which
-- demonstrates that failure before applying this file.
--
-- PORTED VERBATIM from supabase/migrations/20251006_complete_monolithic_setup.sql, and
-- a test asserts the two copies stay byte-identical after whitespace normalisation. Two
-- files now define one rule; the drift guard is what makes that safe rather than a
-- second source of truth waiting to diverge.
--
-- NOT APPLIED AT STARTUP, deliberately. #321 gave the app a least-privilege `dotnet_app`
-- role; creating functions and triggers needs rights that role does not have, and
-- granting them so the app could self-provision would quietly undo that ticket. Apply
-- this when provisioning the database, as the owner:
--
--   psql "$CONN" -f dotnet-messaging/db/c13-sequence-assignment.sql
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS. Safe to re-run, and
-- safe to run against the shared Supabase database, where it is a no-op.

CREATE OR REPLACE FUNCTION assign_sequence_number()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE next_seq BIGINT;
BEGIN
  -- #244: serialize sequence assignment PER CONVERSATION. The plain MAX+1 below
  -- is a read-modify-write: two concurrent inserts into the same conversation
  -- both read the same MAX, compute the same next_seq, and the loser violates
  -- unique_sequence (23505) — the message is dropped, and a client retry just
  -- re-enters this same race. A transaction-scoped advisory lock keyed on the
  -- conversation makes the MAX+1 atomic: the second insert BLOCKS (not errors)
  -- until the first commits, then reads the now-correct MAX. Auto-released at
  -- COMMIT/ROLLBACK — no unlock bookkeeping, no leak on error.
  --
  -- Key: two int4s carved from the conversation UUID's hex, using the
  -- pg_advisory_xact_lock(int4,int4) overload (a distinct lock space from the
  -- single-bigint form). Effective entropy ~60 bits (a UUID-v4 has a fixed
  -- version nibble inside the first 16 hex chars) — a cross-conversation key
  -- collision only makes two UNRELATED conversations briefly serialize (benign,
  -- vanishingly rare: ~C^2/2^61), never a wrong sequence. Only same-conversation
  -- inserts actually contend, which is exactly what we want.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(replace(NEW.conversation_id::text, '-', ''), 1, 8))::bit(32)::int,
    ('x' || substr(replace(NEW.conversation_id::text, '-', ''), 9, 8))::bit(32)::int
  );

  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM messages WHERE conversation_id = NEW.conversation_id;
  NEW.sequence_number := next_seq;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_message_insert ON messages;
CREATE TRIGGER before_message_insert
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION assign_sequence_number();

COMMENT ON FUNCTION assign_sequence_number() IS 'Auto-increment message sequence numbers';
