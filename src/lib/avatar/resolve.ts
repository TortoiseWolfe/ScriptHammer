/**
 * Pick the avatar address to show for the signed-in user (#1514).
 *
 * Two places hold an avatar address:
 *
 * - `user_profiles.avatar_url` is the source of truth. Upload and remove write
 *   it first and treat a failure there as fatal.
 * - `user_metadata.avatar_url` on the auth account is only a mirror, written
 *   afterwards on a best-effort basis (#1068).
 *
 * The mirror can be left pointing at a file that no longer exists: remove clears
 * the profile, tries to clear the mirror, then deletes the file, and two browsers
 * working on one account can interleave those steps (or the mirror write can
 * fail). Showing the mirror while the profile says "no avatar" then asks storage
 * for a missing file, which answers HTTP 400, and WebKit logs that as a console
 * error. The hosted E2E run failed two WebKit tests on exactly that.
 *
 * So the mirror is used only when the profile has no row at all (a new account
 * whose avatar came from an OAuth provider). While the profile is still loading
 * nothing is shown, so the mirror is never requested before the profile has had
 * a chance to say it is empty.
 */
export interface AvatarProfileState {
  /** The `user_profiles` row, or null when there is none (or it has not loaded). */
  profile: { avatar_url: string | null } | null;
  /** True while the profile row is being fetched. */
  loading: boolean;
}

export function resolveAvatarUrl(
  { profile, loading }: AvatarProfileState,
  metadataAvatarUrl: unknown
): string | null {
  if (loading) return null;
  if (profile) return profile.avatar_url || null;
  return typeof metadataAvatarUrl === 'string' && metadataAvatarUrl
    ? metadataAvatarUrl
    : null;
}
