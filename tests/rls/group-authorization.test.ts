/**
 * RLS: the group-authorization family (#1247, stage B1).
 *
 * Five holes shared a few policies, and the #1059 lesson is that fixes in such a family reopen
 * each other — so they are pinned together. Every refusal below is built from a passing CONTROL
 * by changing ONE thing, so a refusal can only pass for the reason it names, and each control
 * proves the legitimate path still works (a policy that refuses everyone would pass every
 * refusal test on its own).
 *
 *   F1  a member makes themselves owner (UPDATE role; also an owner-less group)
 *   F3  any member plants or forges group_keys rows (created_by, version, target, JWK)
 *   F4  a removed creator re-seats themselves, or keeps reading the roster and the group row
 *   F5  a removed member un-removes themselves (a FILTERED PATCH — PostgREST's `safeupdate`
 *       refuses a filterless one on both the local stack and production, measured 2026-09-24)
 *   +   the review found more of the same family: a colluding member re-adding someone the owner
 *       removed, a participant seating a third party into a 1:1 thread, a leaver backdating
 *       left_at, and an owner rewriting another member's archive flag
 *
 * Production has 0 conversation_members and 0 group_keys rows (measured 2026-09-24), so these
 * are reachable-by-REST holes in the template, not incidents.
 *
 * @module tests/rls/group-authorization.test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceClient,
  createAuthenticatedClient,
  createTestUser,
  deleteTestUser,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

// Distinct P-256-shaped public keys. Only crv/x/y are compared, so extra members are allowed.
const jwk = (tag: string) => ({
  kty: 'EC',
  crv: 'P-256',
  x: `x-${tag}-${'A'.repeat(20)}`,
  y: `y-${tag}-${'B'.repeat(20)}`,
});

type Row = Record<string, unknown>;

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: group authorization family (#1247 B1) [${RLS_SKIP_REASON}]`,
  () => {
    let a: TestUser; // creator / owner
    let b: TestUser; // member
    let c: TestUser; // a third person
    let aClient: SupabaseClient;
    let bClient: SupabaseClient;
    let service: SupabaseClient;
    const groups: string[] = [];
    const A_KEY = jwk('a');
    const A_OLD = jwk('a-revoked');
    const B_KEY = jwk('b');

    const db = () => service as unknown as SupabaseClient;

    async function group(name: string, extra: Row = {}): Promise<string> {
      const { data, error } = await db()
        .from('conversations')
        .insert({
          is_group: true,
          group_name: `#1247 ${name}`,
          created_by: a.id,
          current_key_version: 1,
          ...extra,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`seed group: ${error?.message}`);
      groups.push(data.id as string);
      return data.id as string;
    }

    async function seat(
      conv: string,
      user: TestUser,
      role: 'owner' | 'member',
      extra: Row = {}
    ) {
      const { error } = await db()
        .from('conversation_members')
        .insert({
          conversation_id: conv,
          user_id: user.id,
          role,
          key_version_joined: 1,
          key_status: 'active',
          ...extra,
        });
      if (error) throw new Error(`seat: ${error.message}`);
    }

    async function member(conv: string, user: TestUser): Promise<Row[]> {
      const { data, error } = await db()
        .from('conversation_members')
        .select('role, left_at, archived, joined_at')
        .eq('conversation_id', conv)
        .eq('user_id', user.id)
        .order('joined_at');
      if (error) throw new Error(`read member: ${error.message}`);
      return (data ?? []) as Row[];
    }

    async function connect(x: TestUser, y: TestUser) {
      await db()
        .from('user_connections')
        .delete()
        .or(
          `and(requester_id.eq.${x.id},addressee_id.eq.${y.id}),and(requester_id.eq.${y.id},addressee_id.eq.${x.id})`
        );
      const { error } = await db()
        .from('user_connections')
        .insert({ requester_id: x.id, addressee_id: y.id, status: 'accepted' });
      if (error) throw new Error(`connect: ${error.message}`);
    }

    async function keysFor(conv: string, user: TestUser, version: number) {
      const { data } = await db()
        .from('group_keys')
        .select('id')
        .eq('conversation_id', conv)
        .eq('user_id', user.id)
        .eq('key_version', version);
      return data ?? [];
    }

    beforeAll(async () => {
      service = createServiceClient() as unknown as SupabaseClient;
      a = await createTestUser(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      );
      b = await createTestUser(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      );
      c = await createTestUser(
        TEST_USERS.admin.email,
        TEST_USERS.admin.password
      );
      aClient = (await createAuthenticatedClient(
        TEST_USERS.userA.email,
        TEST_USERS.userA.password
      )) as unknown as SupabaseClient;
      bClient = (await createAuthenticatedClient(
        TEST_USERS.userB.email,
        TEST_USERS.userB.password
      )) as unknown as SupabaseClient;
      await connect(a, b);
      await connect(b, c);
      await connect(a, c);
      await db()
        .from('user_encryption_keys')
        .delete()
        .in('user_id', [a.id, b.id]);
      const { error } = await db()
        .from('user_encryption_keys')
        .insert([
          {
            user_id: a.id,
            public_key: A_KEY,
            device_id: '1247-a',
            revoked: false,
          },
          {
            user_id: a.id,
            public_key: A_OLD,
            device_id: '1247-a-old',
            revoked: true,
          },
          {
            user_id: b.id,
            public_key: B_KEY,
            device_id: '1247-b',
            revoked: false,
          },
        ]);
      if (error) throw new Error(`seed keys: ${error.message}`);
    });

    afterAll(async () => {
      for (const id of groups)
        await db().from('conversations').delete().eq('id', id);
      await db()
        .from('user_encryption_keys')
        .delete()
        .in('device_id', ['1247-a', '1247-a-old', '1247-b']);
      for (const [x, y] of [
        [a, b],
        [b, c],
        [a, c],
      ] as const) {
        await db()
          .from('user_connections')
          .delete()
          .or(
            `and(requester_id.eq.${x.id},addressee_id.eq.${y.id}),and(requester_id.eq.${y.id},addressee_id.eq.${x.id})`
          );
      }
      for (const u of [a, b, c]) if (u) await deleteTestUser(u.id);
    });

    describe('F1: role changes', () => {
      it('a member cannot make themselves owner', async () => {
        const g = await group('F1 self-promote');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const { error } = await bClient
          .from('conversation_members')
          .update({ role: 'owner' })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect(error).not.toBeNull();
        expect((await member(g, b))[0].role).toBe('member');
      });

      it('CONTROL: a member may archive their own row', async () => {
        const g = await group('F1 control archive');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const { error } = await bClient
          .from('conversation_members')
          .update({ archived: true })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect(error).toBeNull();
        expect((await member(g, b))[0].archived).toBe(true);
      });

      it("an owner cannot rewrite another member's archive flag", async () => {
        const g = await group('F1 cross archive');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await aClient
          .from('conversation_members')
          .update({ archived: true })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect((await member(g, b))[0].archived).toBe(false);
      });

      it('the only owner cannot demote themselves while others remain', async () => {
        const g = await group('F1 ownerless demote');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const { error } = await aClient
          .from('conversation_members')
          .update({ role: 'member' })
          .eq('conversation_id', g)
          .eq('user_id', a.id);
        expect(error).not.toBeNull();
        expect((await member(g, a))[0].role).toBe('owner');
      });

      it('CONTROL: promote first, then demote — ownership moves', async () => {
        const g = await group('F1 control transfer');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const promote = await aClient
          .from('conversation_members')
          .update({ role: 'owner' })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect(promote.error).toBeNull();
        const demote = await aClient
          .from('conversation_members')
          .update({ role: 'member' })
          .eq('conversation_id', g)
          .eq('user_id', a.id);
        expect(demote.error).toBeNull();
        expect((await member(g, a))[0].role).toBe('member');
        expect((await member(g, b))[0].role).toBe('owner');
      });

      it('one PATCH cannot demote both owners at once', async () => {
        // The policies judge each row against the statement's starting snapshot, so only a
        // trigger that re-reads the table sees the first row's change when it checks the second.
        const g = await group('F1 multi-row demote');
        await seat(g, a, 'owner');
        await seat(g, c, 'owner');
        await seat(g, b, 'member');
        await aClient
          .from('conversation_members')
          .update({ role: 'member' })
          .eq('conversation_id', g)
          .eq('role', 'owner');
        const owners = [
          ...(await member(g, a)),
          ...(await member(g, c)),
        ].filter((r) => r.role === 'owner');
        expect(owners.length).toBeGreaterThan(0);
      });

      it('the only owner cannot walk out while others remain', async () => {
        const g = await group('F1 owner leaves');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await aClient
          .from('conversation_members')
          .update({ left_at: new Date().toISOString() })
          .eq('conversation_id', g)
          .eq('user_id', a.id);
        expect((await member(g, a))[0].left_at).toBeNull();
      });

      it('CONTROL: the last person in a group may leave it', async () => {
        const g = await group('F1 control last leaves');
        await seat(g, a, 'owner');
        const { error } = await aClient
          .from('conversation_members')
          .update({ left_at: new Date().toISOString() })
          .eq('conversation_id', g)
          .eq('user_id', a.id);
        expect(error).toBeNull();
        expect((await member(g, a))[0].left_at).not.toBeNull();
      });
    });

    describe('F5: a departed row stays departed', () => {
      it('a removed member cannot un-remove themselves with a filtered PATCH', async () => {
        // NOT red on main, and that is a finding: #1247 listed this as unconfirmed, and the live
        // test says a departed member cannot even SEE their own row (the SELECT policy asks for
        // an active membership), so their PATCH matches nothing. It is kept as a pin: the new
        // update guard freezes departed rows as well, so this now holds for two reasons.
        const g = await group('F5 self');
        await seat(g, a, 'owner');
        await seat(g, b, 'member', {
          left_at: new Date(Date.now() - 3600_000).toISOString(),
        });
        await bClient
          .from('conversation_members')
          .update({ left_at: null })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect((await member(g, b))[0].left_at).not.toBeNull();
      });

      it('an owner cannot reactivate a removed member by editing their old row', async () => {
        const g = await group('F5 owner');
        await seat(g, a, 'owner');
        await seat(g, b, 'member', {
          left_at: new Date(Date.now() - 3600_000).toISOString(),
        });
        await aClient
          .from('conversation_members')
          .update({ left_at: null })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect((await member(g, b))[0].left_at).not.toBeNull();
      });

      it('CONTROL: the owner may remove a member', async () => {
        const g = await group('F5 control remove');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const { error } = await aClient
          .from('conversation_members')
          .update({ left_at: new Date().toISOString() })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        expect(error).toBeNull();
        expect((await member(g, b))[0].left_at).not.toBeNull();
      });

      it('a leaver cannot backdate their departure', async () => {
        // A backdated left_at would dodge the owner's "rotate if a departure is newer than my
        // key" check. The row records when it actually happened.
        const g = await group('F5 backdate');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await bClient
          .from('conversation_members')
          .update({ left_at: '2000-01-01T00:00:00Z' })
          .eq('conversation_id', g)
          .eq('user_id', b.id);
        const left = (await member(g, b))[0].left_at as string | null;
        expect(left).not.toBeNull();
        expect(Date.now() - new Date(left as string).getTime()).toBeLessThan(
          10 * 60_000
        );
      });
    });

    describe('F4 and seating', () => {
      it('a removed creator cannot re-seat themselves', async () => {
        const g = await group('F4 re-seat');
        await seat(g, a, 'owner', { left_at: new Date().toISOString() });
        await seat(g, b, 'owner');
        await aClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: a.id,
          role: 'owner',
          key_version_joined: 1,
        });
        const active = (await member(g, a)).filter((r) => r.left_at === null);
        expect(active).toEqual([]);
      });

      it('a removed creator can read neither the roster nor the group', async () => {
        const g = await group('F4 read');
        await seat(g, a, 'owner', { left_at: new Date().toISOString() });
        await seat(g, b, 'owner');
        const roster = await aClient
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', g);
        const row = await aClient
          .from('conversations')
          .select('id')
          .eq('id', g);
        expect(roster.data ?? []).toEqual([]);
        expect(row.data ?? []).toEqual([]);
        // CONTROL, same group: the active member reads both.
        const bRoster = await bClient
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', g);
        const bRow = await bClient
          .from('conversations')
          .select('id')
          .eq('id', g);
        expect((bRoster.data ?? []).length).toBeGreaterThan(0);
        expect(bRow.data ?? []).toHaveLength(1);
      });

      it('a member cannot re-add someone the owner removed', async () => {
        const g = await group('seat re-add');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await seat(g, c, 'member', { left_at: new Date().toISOString() });
        await bClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: c.id,
          role: 'member',
          key_version_joined: 1,
        });
        expect((await member(g, c)).filter((r) => r.left_at === null)).toEqual(
          []
        );
      });

      it('a member cannot seat someone straight into owner', async () => {
        // F1 by INSERT: the old member branch never looked at role, so an accomplice could be
        // seated as owner and then remove everyone, the real owner included.
        const g = await group('seat as owner');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await bClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: c.id,
          role: 'owner',
          key_version_joined: 1,
        });
        expect((await member(g, c)).filter((r) => r.role === 'owner')).toEqual(
          []
        );
      });

      it('a founder who seated others first cannot crown themselves later', async () => {
        // "I created it" counts only until the first seat. Without this, the founder of a group
        // seated by direct REST without an owner row could claim it at any later time. The
        // re-add guard cannot see this one — the founder never held a row — so this pins the
        // policy's founder branch on its own.
        const g = await group('founder late');
        await seat(g, b, 'member');
        await aClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: a.id,
          role: 'owner',
          key_version_joined: 1,
        });
        expect(await member(g, a)).toEqual([]);
      });

      it('CONTROL: a member may seat a connection who was never in the group', async () => {
        const g = await group('seat control');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const { error } = await bClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: c.id,
          role: 'member',
          key_version_joined: 1,
        });
        expect(error).toBeNull();
        expect(
          (await member(g, c)).filter((r) => r.left_at === null)
        ).toHaveLength(1);
      });

      it('nobody chooses their own joined_at', async () => {
        // joined_at orders the owner hand-over when an owner's account is erased.
        const g = await group('seat joined_at');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await bClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: c.id,
          role: 'member',
          key_version_joined: 1,
          joined_at: '1970-01-01T00:00:00Z',
        });
        expect(await member(g, c)).toEqual([]);
      });

      it('a participant cannot seat a third party into a 1:1 conversation', async () => {
        const { data, error } = await db()
          .from('conversations')
          .insert({
            is_group: false,
            // canonical_ordering: the smaller id first. A first draft got this wrong, and
            // its "red on main" was the seed failing — not the hole. The mutation run is
            // what proves this case can see the hole.
            participant_1_id: a.id < b.id ? a.id : b.id,
            participant_2_id: a.id < b.id ? b.id : a.id,
            created_by: a.id,
          })
          .select('id')
          .single();
        if (error || !data) throw new Error(`seed 1:1: ${error?.message}`);
        groups.push(data.id as string);
        await aClient.from('conversation_members').insert({
          conversation_id: data.id,
          user_id: c.id,
          role: 'member',
          key_version_joined: 1,
        });
        expect(await member(data.id as string, c)).toEqual([]);
      });

      it('CONTROL: createGroup exactly as the shipped client does it', async () => {
        // insert().select() on the group row, then ONE multi-row seat with RETURNING — the
        // shape a tab running today's bundle sends, which must keep working through the change.
        const created = await aClient
          .from('conversations')
          .insert({
            is_group: true,
            group_name: '#1247 client create',
            created_by: a.id,
            current_key_version: 1,
          })
          .select()
          .single();
        expect(created.error).toBeNull();
        const g = (created.data as Row).id as string;
        groups.push(g);
        const seated = await aClient
          .from('conversation_members')
          .insert([
            {
              conversation_id: g,
              user_id: a.id,
              role: 'owner',
              key_version_joined: 1,
              key_status: 'active',
            },
            {
              conversation_id: g,
              user_id: b.id,
              role: 'member',
              key_version_joined: 1,
              key_status: 'active',
            },
          ])
          .select();
        expect(seated.error).toBeNull();
        expect(seated.data ?? []).toHaveLength(2);
        const keys = await aClient.from('group_keys').insert([
          {
            conversation_id: g,
            user_id: a.id,
            key_version: 1,
            encrypted_key: 'k-a',
            created_by: a.id,
            creator_public_key: A_KEY,
          },
          {
            conversation_id: g,
            user_id: b.id,
            key_version: 1,
            encrypted_key: 'k-b',
            created_by: a.id,
            creator_public_key: A_KEY,
          },
        ]);
        expect(keys.error).toBeNull();
      });

      it('CONTROL: createGroup as the #1247 B2 client does it — its own id, no RETURNING', async () => {
        // Stage 1 of B2 ships app-first, against the policies production has now. The group row
        // goes in with a client-chosen id and no read-back; the seat keeps its RETURNING; the row
        // is read back once the creator is a member.
        const g = crypto.randomUUID();
        const inserted = await aClient.from('conversations').insert({
          id: g,
          is_group: true,
          group_name: '#1247 B2 client create',
          created_by: a.id,
          current_key_version: 1,
        });
        expect(inserted.error).toBeNull();
        groups.push(g);
        const seated = await aClient
          .from('conversation_members')
          .insert([
            {
              conversation_id: g,
              user_id: a.id,
              role: 'owner',
              key_version_joined: 1,
              key_status: 'active',
            },
            {
              conversation_id: g,
              user_id: b.id,
              role: 'member',
              key_version_joined: 1,
              key_status: 'active',
            },
          ])
          .select('id');
        expect(seated.error).toBeNull();
        expect(seated.data ?? []).toHaveLength(2);
        const readBack = await aClient
          .from('conversations')
          .select('created_at, last_message_at')
          .eq('id', g)
          .single();
        expect(readBack.error).toBeNull();
        expect(readBack.data?.created_at).toBeTruthy();
      });
    });

    describe('F3: group_keys', () => {
      // EVERY case gets its own group. With one shared group, a refusal that inserted on main
      // occupied a (user, version) slot, and a later case "passed" on main by colliding with the
      // UNIQUE constraint instead of meeting its own rule — observed on the first red run.
      async function keysGroup(name: string) {
        const g = await group(`F3 ${name}`);
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        await seat(g, c, 'member');
        return g;
      }
      const put = (client: SupabaseClient, g: string, row: Row) =>
        client
          .from('group_keys')
          .insert({ conversation_id: g, encrypted_key: 'k', ...row });

      it('CONTROL: the owner distributes at the current version with their own key', async () => {
        const g = await keysGroup('control current');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 1,
          created_by: a.id,
          creator_public_key: A_KEY,
        });
        expect(r.error).toBeNull();
        expect(await keysFor(g, b, 1)).toHaveLength(1);
      });

      it('CONTROL: a revoked but registered key of the owner is accepted (#243)', async () => {
        const g = await keysGroup('control revoked');
        const r = await put(aClient, g, {
          user_id: c.id,
          key_version: 1,
          created_by: a.id,
          creator_public_key: A_OLD,
        });
        expect(r.error).toBeNull();
        expect(await keysFor(g, c, 1)).toHaveLength(1);
      });

      it('CONTROL: the owner may rotate to current + 1', async () => {
        const g = await keysGroup('control rotate');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 2,
          created_by: a.id,
          creator_public_key: A_KEY,
        });
        expect(r.error).toBeNull();
        expect(await keysFor(g, b, 2)).toHaveLength(1);
      });

      it('a non-owner member cannot write key rows', async () => {
        const g = await keysGroup('non-owner');
        const r = await put(bClient, g, {
          user_id: c.id,
          key_version: 1,
          created_by: b.id,
          creator_public_key: B_KEY,
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, c, 1)).toEqual([]);
      });

      it('created_by must be the caller', async () => {
        const g = await keysGroup('created_by');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 1,
          created_by: b.id,
          creator_public_key: A_KEY,
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, b, 1)).toEqual([]);
      });

      it('the version cannot jump past current + 1', async () => {
        const g = await keysGroup('version');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 3,
          created_by: a.id,
          creator_public_key: A_KEY,
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, b, 3)).toEqual([]);
      });

      it("the JWK must be one of the caller's registered keys", async () => {
        const g = await keysGroup('foreign jwk');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 1,
          created_by: a.id,
          creator_public_key: B_KEY,
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, b, 1)).toEqual([]);
      });

      it('a key row must name its JWK', async () => {
        const g = await keysGroup('null jwk');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 1,
          created_by: a.id,
          creator_public_key: null,
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, b, 1)).toEqual([]);
      });

      it('the target must be an active member', async () => {
        const g = await group('F3 departed target');
        await seat(g, a, 'owner');
        await seat(g, c, 'member', { left_at: new Date().toISOString() });
        const r = await put(aClient, g, {
          user_id: c.id,
          key_version: 1,
          created_by: a.id,
          creator_public_key: A_KEY,
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, c, 1)).toEqual([]);
      });

      it('nobody chooses a key row\u2019s created_at', async () => {
        const g = await keysGroup('created_at');
        const r = await put(aClient, g, {
          user_id: b.id,
          key_version: 1,
          created_by: a.id,
          creator_public_key: A_KEY,
          created_at: '2000-01-01T00:00:00Z',
        });
        expect(r.error).not.toBeNull();
        expect(await keysFor(g, b, 1)).toEqual([]);
      });
    });
  }
);
