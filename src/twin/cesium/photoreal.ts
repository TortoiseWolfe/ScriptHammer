// Google Photorealistic 3D Tiles on the atlas — WEB ONLY, and opt-in.
//
// WHY THIS IS HERE AND NOT IN THE GAME. The mobile build cannot have this and
// the reason is not effort, it is the terms: the Map Tiles API prohibits
// pre-fetching, caching and "offline uses", so a game you can play on a plane
// is off the table by licence. What the terms DO permit, affirmatively, is
// "overlay your own 3D objects on Photorealistic 3D Tiles as long as the 3D
// objects aren't extracted, traced, or otherwise derived" — which is why
// Cesium's own helper defaults `enableCollision` to true.
//
// WHAT IT IS ACTUALLY FOR. Chattanooga's photorealistic mesh is Google's
// OLDEST tier — auto-meshed in 2014 from a camera-plane fleet, the first city
// in Tennessee. Google's own FAQ names the artefacts: cars and awnings melted
// into the mesh, tree canopies modelled as floating objects, its own datum so
// survey data lands offset. The game's camera frames ~46 m (60–180 ft), which
// is squarely the band where aerial photogrammetry stops holding up.
//
// So this exists to answer "is it good enough to want?" BY LOOKING, on a build
// with no licence friction and no mobile risk, before anyone spends a week
// porting a 3D Tiles renderer to Hermes. If it looks poor over this city, that
// is a finding worth a day. If it looks superb, that is worth knowing too.
//
// THE KEY IS PUBLIC BY DESIGN AND MUST STILL BE RESTRICTED. A browser Maps key
// is sent to Google from the page, so it cannot be secret and NEXT_PUBLIC_ is
// correct. It must carry an HTTP-referrer restriction to this site's origins,
// or anyone can spend the quota. That restriction is set in Google Cloud
// console, not here, and nothing in this repo can enforce it.
import type * as CesiumNS from 'cesium';

/** Env name in one place — a typo here fails silently as "no key". */
export const KEY_ENV = 'NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY';

export type PhotorealPlan =
  | { kind: 'off' }
  | { kind: 'no-key' }
  | { kind: 'on'; key: string };

/**
 * Should this page draw Google's tiles, and can it?
 *
 * Three outcomes rather than a boolean, because "asked for and unavailable"
 * must be distinguishable from "not asked for". Collapsing them is how a
 * missing key becomes an unexplained blank globe.
 *
 * Reads a search string rather than `window`, so it is testable and so the
 * caller keeps the `window.location.search` convention this directory already
 * uses (`useSearchParams` forces a Suspense bailout under output:'export').
 */
export function planPhotoreal(
  search: string,
  key: string | undefined
): PhotorealPlan {
  const params = new URLSearchParams(search);
  if (!params.has('photoreal')) return { kind: 'off' };
  // `?photoreal=off` is an escape hatch for a deployment that sets the key but
  // wants a link that provably shows the baked twin.
  const v = params.get('photoreal');
  if (v === 'off' || v === '0' || v === 'false') return { kind: 'off' };
  const trimmed = (key ?? '').trim();
  return trimmed ? { kind: 'on', key: trimmed } : { kind: 'no-key' };
}

/** What a viewer showed, so the HUD can report it rather than guess. */
export type PhotorealResult =
  | { ok: true; tileset: CesiumNS.Cesium3DTileset }
  | { ok: false; reason: string };

/**
 * Add the tileset and get out of its way.
 *
 * THE GLOBE HAS TO GO. These tiles carry their own ground AND their own
 * buildings; leaving the ellipsoid and its imagery switched on puts a second
 * surface a few metres from the first, and the two z-fight across the whole
 * city. Cesium's own guidance is to hide the globe, and it is not cosmetic.
 *
 * THE CREDITS MUST NOT. Attribution is a condition of the terms, and the
 * tileset supplies it through the viewer's credit display automatically. Do
 * not hide the credit container to tidy up a screenshot.
 *
 * `onlyUsingWithGoogleGeocoder` is set true and that is honest here rather
 * than a way past a warning: this viewer is constructed with `geocoder: false`,
 * so no other geocoder is in use. If one is ever added, this has to change.
 */
export async function attachPhotoreal(
  Cesium: typeof CesiumNS,
  viewer: CesiumNS.Viewer,
  key: string
): Promise<PhotorealResult> {
  try {
    Cesium.GoogleMaps.defaultApiKey = key;
    const tileset = await Cesium.createGooglePhotorealistic3DTileset({
      key,
      onlyUsingWithGoogleGeocoder: true,
    });
    viewer.scene.primitives.add(tileset);
    viewer.scene.globe.show = false;
    return { ok: true, tileset };
  } catch (e) {
    // A bad or unrestricted key fails HERE, at the root tileset request, and
    // the message is the only thing that distinguishes it from a network
    // problem. Surface it rather than logging a blank globe.
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
