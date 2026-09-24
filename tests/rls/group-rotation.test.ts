/**
 * RLS: group key rotation lands, and only the way it should (#1247 B2).
 *
 * Removing someone from a group is supposed to rotate the group key so they cannot read what
 * comes next. It never worked. The owner wrote the new key rows, then bumped
 * `conversations.current_key_version` — but group rows had no UPDATE policy an owner matches
 * (the participant policy compares NULL participant columns), so the bump updated 0 rows with no
 * error. Rename, delete and createGroup's rollbacks failed the same silent way, which is how
 * production collected its empty group shells.
 *
 * B2 gives the owner UPDATE and DELETE on their group rows, guards the version bump (one step at
 * a time, by an active owner who already holds the new key, with every keyed member covered),
 * and adds `rotate_group_key`, which writes the rows and bumps in one transaction so a failed
 * rotation leaves nothing behind. Every refusal below asserts its own message: a refusal that
 * could come from a different rule proves nothing about this one.
 *
 * @module tests/rls/group-rotation.test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceClient,
  createAuthenticatedClient,
  createTestUser,
  deleteConversations,
  hasRlsTestEnvironment,
  RLS_SKIP_REASON,
  TEST_USERS,
  type TestUser,
} from '../fixtures/test-users';

const DB = {
  host: process.env.SUPABASE_DB_HOST ?? 'supabase-db',
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? 'postgres',
  user: process.env.SUPABASE_DB_USER ?? 'postgres',
  password:
    process.env.POSTGRES_PASSWORD ??
    'your-super-secret-and-long-postgres-password',
};

const jwk = (tag: string) => ({
  kty: 'EC',
  crv: 'P-256',
  x: `x-${tag}-${'C'.repeat(20)}`,
  y: `y-${tag}-${'D'.repeat(20)}`,
});

type Row = Record<string, unknown>;

describe.skipIf(!hasRlsTestEnvironment())(
  `RLS: group key rotation (#1247 B2) [${RLS_SKIP_REASON}]`,
  () => {
    let a: TestUser; // owner
    let b: TestUser; // member
    let c: TestUser; // another member / a connection of both
    let aClient: SupabaseClient;
    let bClient: SupabaseClient;
    let service: SupabaseClient;
    const groups: string[] = [];
    const oneToOnes: string[] = [];
    const KEY = { a: jwk('a'), b: jwk('b'), c: jwk('c') };
    const DEVICES = ['1247b2-a', '1247b2-b', '1247b2-c'];

    const db = () => service;

    async function group(name: string): Promise<string> {
      const { data, error } = await db()
        .from('conversations')
        .insert({
          is_group: true,
          group_name: `#1247 B2 ${name}`,
          created_by: a.id,
          current_key_version: 1,
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
      role: 'owner' | 'member'
    ) {
      const { error } = await db().from('conversation_members').insert({
        conversation_id: conv,
        user_id: user.id,
        role,
        key_version_joined: 1,
        key_status: 'active',
      });
      if (error) throw new Error(`seat: ${error.message}`);
    }

    /** A key row written by the service role, which the guards exempt. */
    async function serviceKey(conv: string, user: TestUser, version: number) {
      const { error } = await db()
        .from('group_keys')
        .insert({
          conversation_id: conv,
          user_id: user.id,
          key_version: version,
          encrypted_key: `svc-${user.id.slice(0, 4)}-${version}`,
          created_by: a.id,
          creator_public_key: KEY.a,
        });
      if (error) throw new Error(`service key: ${error.message}`);
    }

    /** The owner writes their own key rows, as rotateGroupKey does before bumping. */
    async function ownerKeys(conv: string, users: TestUser[], version: number) {
      const { error } = await aClient.from('group_keys').insert(
        users.map((u) => ({
          conversation_id: conv,
          user_id: u.id,
          key_version: version,
          encrypted_key: `a-${u.id.slice(0, 4)}-${version}`,
          created_by: a.id,
          creator_public_key: KEY.a,
        }))
      );
      if (error) throw new Error(`owner keys: ${error.message}`);
    }

    async function version(conv: string): Promise<number> {
      const { data, error } = await db()
        .from('conversations')
        .select('current_key_version')
        .eq('id', conv)
        .single();
      if (error) throw new Error(`read version: ${error.message}`);
      return data!.current_key_version as number;
    }

    async function keyCount(conv: string, v: number): Promise<number> {
      const { count } = await db()
        .from('group_keys')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv)
        .eq('key_version', v);
      return count ?? 0;
    }

    /** Owner a, members b and c, everyone keyed at v1. */
    async function fullGroup(name: string): Promise<string> {
      const g = await group(name);
      await seat(g, a, 'owner');
      await seat(g, b, 'member');
      await seat(g, c, 'member');
      for (const u of [a, b, c]) await serviceKey(g, u, 1);
      return g;
    }

    const rows = (users: TestUser[]) =>
      users.map((u) => ({
        user_id: u.id,
        encrypted_key: `rpc-${u.id.slice(0, 4)}`,
        creator_public_key: KEY.a,
      }));

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
      await connect(a, c);
      await connect(b, c);
      await db().from('user_encryption_keys').delete().in('device_id', DEVICES);
      const { error } = await db()
        .from('user_encryption_keys')
        .insert([
          {
            user_id: a.id,
            public_key: KEY.a,
            device_id: DEVICES[0],
            revoked: false,
          },
          {
            user_id: b.id,
            public_key: KEY.b,
            device_id: DEVICES[1],
            revoked: false,
          },
          {
            user_id: c.id,
            public_key: KEY.c,
            device_id: DEVICES[2],
            revoked: false,
          },
        ]);
      if (error) throw new Error(`seed keys: ${error.message}`);
    });

    afterAll(async () => {
      // Teardown must not hide a failure: a delete that errors is what leaked 1,400+ local groups
      // before the F10 early return.
      await deleteConversations(db(), [...groups, ...oneToOnes]);
      await db().from('user_encryption_keys').delete().in('device_id', DEVICES);
      for (const [x, y] of [
        [a, b],
        [a, c],
        [b, c],
      ] as const) {
        await db()
          .from('user_connections')
          .delete()
          .or(
            `and(requester_id.eq.${x.id},addressee_id.eq.${y.id}),and(requester_id.eq.${y.id},addressee_id.eq.${x.id})`
          );
      }
    });

    describe('F2: the owner’s writes to the group row land', () => {
      it('rotate_group_key writes the rows and bumps in one step', async () => {
        const g = await fullGroup('rpc rotation');

        const { data, error } = await aClient.rpc('rotate_group_key', {
          p_conversation_id: g,
          p_from_version: 1,
          p_rows: rows([a, b, c]),
        });

        expect(error).toBeNull();
        expect(data).toBe(2);
        expect(await version(g)).toBe(2);
        expect(await keyCount(g, 2)).toBe(3);
      });

      it('a direct bump lands once every active member holds the new version', async () => {
        const g = await fullGroup('patch rotation');
        await ownerKeys(g, [a, b, c], 2);

        const { data, error } = await aClient
          .from('conversations')
          .update({ current_key_version: 2 })
          .eq('id', g)
          .eq('current_key_version', 1)
          .select('id');

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(await version(g)).toBe(2);
      });

      it('a second rotation follows the first', async () => {
        // With the first bump stuck, the version stayed 1 and v3 key rows were refused as
        // "not the current version or the next one": rotation could never happen twice.
        const g = await fullGroup('second rotation');
        await ownerKeys(g, [a, b, c], 2);
        await aClient
          .from('conversations')
          .update({ current_key_version: 2 })
          .eq('id', g)
          .select('id');

        const { error } = await aClient.from('group_keys').insert({
          conversation_id: g,
          user_id: a.id,
          key_version: 3,
          encrypted_key: 'a-3',
          created_by: a.id,
          creator_public_key: KEY.a,
        });
        expect(error).toBeNull();
      });

      it('the owner renames the group', async () => {
        const g = await fullGroup('rename');
        const { data, error } = await aClient
          .from('conversations')
          .update({ group_name: '#1247 B2 renamed' })
          .eq('id', g)
          .select('id');
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
      });

      it('the owner deletes the group, and its members, keys and messages go with it', async () => {
        const g = await fullGroup('owner delete');
        const { data, error } = await aClient
          .from('conversations')
          .delete()
          .eq('id', g)
          .select('id');
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        const { count } = await db()
          .from('conversation_members')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', g);
        expect(count).toBe(0);
        expect(await keyCount(g, 1)).toBe(0);
      });

      it('an unseated founder deletes their own empty group (createGroup’s rollback)', async () => {
        const g = await group('unseated founder delete');
        const { data, error } = await aClient
          .from('conversations')
          .delete()
          .eq('id', g)
          .select('id');
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
      });
    });

    describe('the version guard: each rule refuses on its own', () => {
      it('one step at a time: +2 is refused although the owner holds a v3 row', async () => {
        // The v3 row comes from the service role (exempt), so only the +1 rule can refuse.
        const g = await fullGroup('plus two');
        for (const u of [a, b, c]) await serviceKey(g, u, 3);
        const { error } = await aClient
          .from('conversations')
          .update({ current_key_version: 3 })
          .eq('id', g)
          .select('id');
        expect(error?.message).toMatch(/one version at a time/i);
        expect(await version(g)).toBe(1);
      });

      it('the owner must already hold the new key', async () => {
        const g = await fullGroup('no own row');
        for (const u of [b, c]) await serviceKey(g, u, 2);
        const { error } = await aClient
          .from('conversations')
          .update({ current_key_version: 2 })
          .eq('id', g)
          .select('id');
        expect(error?.message).toMatch(
          /write your own key at the new version first/i
        );
        expect(await version(g)).toBe(1);
      });

      it('every active, keyed member must be covered — nobody is left behind', async () => {
        const g = await fullGroup('incomplete');
        await ownerKeys(g, [a, b], 2); // c is active and keyed at v1, but has no v2 row
        const { error } = await aClient
          .from('conversations')
          .update({ current_key_version: 2 })
          .eq('id', g)
          .select('id');
        expect(error?.message).toMatch(/every active member needs a key/i);
        expect(await version(g)).toBe(1);
      });

      it('a failed rotation leaves no rows behind (the RPC is one transaction)', async () => {
        const g = await fullGroup('rpc incomplete');
        const { error } = await aClient.rpc('rotate_group_key', {
          p_conversation_id: g,
          p_from_version: 1,
          p_rows: rows([a, b]), // c missing
        });
        expect(error?.message).toMatch(/every active member needs a key/i);
        expect(await keyCount(g, 2)).toBe(0);
        expect(await version(g)).toBe(1);
      });

      it('a rotation that lost the race is refused and leaves no rows behind', async () => {
        const g = await fullGroup('rpc stale');
        const first = await aClient.rpc('rotate_group_key', {
          p_conversation_id: g,
          p_from_version: 1,
          p_rows: rows([a, b, c]),
        });
        expect(first.error).toBeNull();
        const stale = await aClient.rpc('rotate_group_key', {
          p_conversation_id: g,
          p_from_version: 1,
          p_rows: rows([a, b, c]),
        });
        expect(stale.error?.message).toMatch(/moved on/i);
        expect(await keyCount(g, 2)).toBe(3);
        expect(await version(g)).toBe(2);
      });

      it('a member cannot rotate, rename or delete: 0 rows, nothing changes', async () => {
        const g = await fullGroup('member writes');
        const bump = await bClient
          .from('conversations')
          .update({ current_key_version: 2 })
          .eq('id', g)
          .select('id');
        const rename = await bClient
          .from('conversations')
          .update({ group_name: 'hijacked' })
          .eq('id', g)
          .select('id');
        const del = await bClient
          .from('conversations')
          .delete()
          .eq('id', g)
          .select('id');
        expect([bump.data, rename.data, del.data]).toEqual([[], [], []]);
        expect(await version(g)).toBe(1);
      });

      it('archived_by_participant_* is not writable on a group row', async () => {
        // The owner UPDATE policy would otherwise open the 1:1 archive columns on group rows.
        const g = await fullGroup('archive columns');
        const { error } = await aClient
          .from('conversations')
          .update({ archived_by_participant_1: true })
          .eq('id', g)
          .select('id');
        expect(error?.message).toMatch(/do not apply to group conversations/i);
      });

      it('a 1:1 participant cannot move current_key_version, and can still archive', async () => {
        const [p1, p2] = [a.id, b.id].sort();
        const { data, error: seedErr } = await db()
          .from('conversations')
          .insert({
            participant_1_id: p1,
            participant_2_id: p2,
            is_group: false,
          })
          .select('id')
          .single();
        expect(seedErr).toBeNull();
        const one = data!.id as string;
        oneToOnes.push(one);

        const bump = await aClient
          .from('conversations')
          .update({ current_key_version: 5 })
          .eq('id', one)
          .select('id');
        expect(bump.error?.message).toMatch(/belongs to group conversations/i);

        const column =
          p1 === a.id
            ? 'archived_by_participant_1'
            : 'archived_by_participant_2';
        const archive = await aClient
          .from('conversations')
          .update({ [column]: true })
          .eq('id', one)
          .select('id');
        expect(archive.error).toBeNull();
        expect(archive.data).toHaveLength(1);
      });

      it('CONTROL: a member’s message still moves last_message_at', async () => {
        const g = await fullGroup('message timestamp');
        const before = (
          await db()
            .from('conversations')
            .select('last_message_at')
            .eq('id', g)
            .single()
        ).data!.last_message_at;
        const { error } = await bClient.from('messages').insert({
          conversation_id: g,
          sender_id: b.id,
          encrypted_content: 'Y2lwaGVy',
          initialization_vector: 'aXY=',
          sequence_number: 0,
          key_version: 1,
        });
        expect(error).toBeNull();
        const after = (
          await db()
            .from('conversations')
            .select('last_message_at')
            .eq('id', g)
            .single()
        ).data!.last_message_at;
        expect(after).not.toBe(before);
      });
    });

    describe('seating is the owner’s job', () => {
      it('a member cannot seat a connection', async () => {
        // B1 lets only an active owner write key rows, so a member-seated person sits keyless.
        const g = await group('member seats');
        await seat(g, a, 'owner');
        await seat(g, b, 'member');
        const { error } = await bClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: c.id,
          role: 'member',
          key_version_joined: 1,
          key_status: 'active',
        });
        expect(error?.code).toBe('42501');
      });

      it('CONTROL: the owner seats the same connection', async () => {
        const g = await group('owner seats');
        await seat(g, a, 'owner');
        const { error } = await aClient.from('conversation_members').insert({
          conversation_id: g,
          user_id: c.id,
          role: 'member',
          key_version_joined: 1,
          key_status: 'active',
        });
        expect(error).toBeNull();
      });
    });

    describe('F10: deleting a group with survivors', () => {
      it('the cascade no longer promotes a member it is about to delete (27000)', async () => {
        const pg = new Client(DB);
        await pg.connect();
        try {
          // The cascade deletes members in heap order (every conversation_members index is
          // partial). 27000 needs the owner's row to come before at least one survivor: the
          // trigger then promotes a survivor the same cascade is about to delete. If the owner
          // is processed last, nobody is left to promote and the old code passes too — so
          // check the order instead of assuming it, and retry on a fresh group if needed.
          let g = '';
          let order: string[] = [];
          for (let attempt = 0; attempt < 5; attempt++) {
            g = await fullGroup(`cascade ${attempt}`);
            const { rows } = await pg.query(
              `SELECT role FROM conversation_members WHERE conversation_id = $1 ORDER BY ctid`,
              [g]
            );
            order = rows.map((r) => r.role as string);
            if (order.at(-1) !== 'owner') break;
          }
          if (order.at(-1) === 'owner') {
            throw new Error(
              `precondition unmet: the owner's row came last in heap order (${order.join(',')}) on every attempt, so no run could show 27000`
            );
          }
          await expect(
            pg.query('DELETE FROM conversations WHERE id = $1', [g])
          ).resolves.toBeDefined();
          const { data } = await db()
            .from('conversations')
            .select('id')
            .eq('id', g);
          expect(data).toEqual([]);
        } finally {
          await pg.end();
        }
      });
    });

    describe('what lazy rotation reads (pins the facts the owner’s client relies on)', () => {
      it('after a member leaves, the owner sees the departure and their own key’s age', async () => {
        const g = await fullGroup('lazy');
        const left = await bClient
          .from('conversation_members')
          .update({ left_at: new Date().toISOString() })
          .eq('conversation_id', g)
          .eq('user_id', b.id)
          .select('id');
        expect(left.data).toHaveLength(1);

        const departed = await aClient
          .from('conversation_members')
          .select('left_at')
          .eq('conversation_id', g)
          .eq('user_id', b.id)
          .single();
        const mine = await aClient
          .from('group_keys')
          .select('created_at')
          .eq('conversation_id', g)
          .eq('user_id', a.id)
          .eq('key_version', 1)
          .single();
        expect(departed.data?.left_at).toBeTruthy();
        expect(mine.data?.created_at).toBeTruthy();
        expect(
          Date.parse(departed.data!.left_at as string) >
            Date.parse(mine.data!.created_at as string)
        ).toBe(true);

        const theirs = await bClient
          .from('group_keys')
          .select('id')
          .eq('conversation_id', g);
        expect(theirs.data ?? []).toEqual([] as Row[]);
      });
    });
  }
);
