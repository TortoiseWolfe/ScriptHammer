import { RULE_LABELS, RULE_COLORS } from './buildings';

// The ONE card that describes a building in the atlas (#303).
//
// A tour stop IS a selected building — the tour caption is this card plus
// prev/next and an N-of-total counter. They used to be two overlays (a
// bottom-centre tour caption and a top-right click card) rendering the same
// three facts (height, provenance rule, OSM way link) through separate JSX, so
// adding a field to one silently skipped the other — the exact divergence trap
// src/lib/height.ts's header warns about. Now there is one component and one
// home: bottom-centre, where the eye already is during a tour.
//
// Removing the top-right card also removes its collision with the nav's
// PWA-install button (#301) and takes the atlas from three overlays to two.
//
// FIXED, not absolute, and z-[55] > the nav's z-50: this container is
// viewport-relative on purpose. The old caption was `absolute bottom-28` inside
// the `relative h-screen` scene, whose bottom edge sat ~65px past the viewport
// (below the nav), so bottom-28 measured up from an off-screen bottom and
// landed the card under the cookie banner. `fixed` sidesteps that entirely, and
// is why this card is unaffected by the nav offset the HUD has to carry.

/** `semidetached_house` -> `semidetached house`; `yes` is not a type. */
export function prettyType(tags?: Record<string, string>): string | null {
  const b = tags?.building;
  if (!b || b === 'yes') return null;
  return b.replace(/_/g, ' ');
}

export function addressOf(tags?: Record<string, string>): string | null {
  if (!tags) return null;
  const a = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ');
  return a || null;
}

export interface BuildingCardModel {
  /** The heading: a tour stop's curated name ("Chattanooga Choo Choo"), or a
   *  clicked building's OSM name / type / "Untyped building". */
  name: string;
  onClose: () => void;

  /** The three shared facts. Absent only for a tour corner-stop with no target
   *  building (describeTargets() left `target` undefined). */
  facts?: {
    heightM: number;
    rule: string;
    /** OpenStreetMap way id — links to /way/<id>. */
    osmWayId: number;
  };

  /** Present IFF this is a tour stop: prev/next, index/total, blurb, and the
   *  stop's data-quality counts. */
  tour?: {
    /** 0-based. */
    index: number;
    total: number;
    blurb: string;
    onPrev: () => void;
    onNext: () => void;
    nearby: number;
    nearbyMeasured: number;
  };

  /** Present IFF this is a clicked building (i.e. not a tour): its live OSM tags
   *  drive the Type/Levels/Address rows and the "untyped — tag it" civic ask.
   *  A baked-only building has no tags, so this is `{}` (still a click), which
   *  the untyped ask keys off. `undefined` means "tour, not a click". */
  tags?: Record<string, string>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2 text-[11px]">
      <span className="text-base-content">{k}</span>
      <span className="font-mono break-words">{v}</span>
    </div>
  );
}

export function BuildingCard({ model }: { model: BuildingCardModel }) {
  const { name, onClose, facts, tour, tags } = model;
  // A click, not a tour. `tags` is the discriminant: undefined means tour.
  const isClick = tags !== undefined;
  const untyped = isClick && !tags?.name && !prettyType(tags);
  const hasDetailRows =
    isClick &&
    (prettyType(tags) || tags?.['building:levels'] || addressOf(tags));

  return (
    <div
      data-testid="atlas-card"
      className="bg-base-100/90 rounded-box fixed bottom-28 left-1/2 z-[55] w-[30rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 p-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-center gap-2">
        {tour && (
          <>
            <button
              className="btn btn-xs min-h-0"
              onClick={tour.onPrev}
              aria-label="Previous stop"
            >
              ⏮
            </button>
            <button
              className="btn btn-xs min-h-0"
              onClick={tour.onNext}
              aria-label="Next stop"
            >
              ⏭
            </button>
            <span className="text-base-content font-mono text-[10px]">
              {tour.index + 1}/{tour.total}
            </span>
          </>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {name}
        </span>
        <button
          className="btn btn-xs min-h-0"
          onClick={onClose}
          aria-label={tour ? 'End tour' : 'Close'}
        >
          ✕
        </button>
      </div>

      {/* WHY this stop exists — a name alone says where the camera is, not what
          is on screen. Tour-only. */}
      {tour && (
        <div className="text-base-content mt-1.5 text-[11px] leading-snug">
          {tour.blurb}
        </div>
      )}

      {/* The three shared facts. An atlas whose colours encode provenance should
          say so in words: height, the provenance rule (with its legend colour),
          and the OSM way it came from. */}
      {facts && (
        <div className="border-base-300 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
          <span className="font-mono">{facts.heightM.toFixed(1)} m</span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: RULE_COLORS[facts.rule] ?? RULE_COLORS.fallback,
              }}
            />
            <span className="text-base-content">
              {RULE_LABELS[facts.rule] ?? facts.rule}
            </span>
          </span>
          {tour && (
            <span className="text-base-content">
              <span className="font-mono">{tour.nearby}</span> within 150 m ·{' '}
              <span className="font-mono">{tour.nearbyMeasured}</span> measured
            </span>
          )}
          <a
            className="link link-primary"
            href={`https://www.openstreetmap.org/way/${facts.osmWayId}`}
            target="_blank"
            rel="noreferrer"
          >
            OSM →
          </a>
        </div>
      )}

      {/* Only rows we actually have. 85% of the box is building=yes with no
          name/address, so empty rows would be noise on most clicks — and the
          absence IS the civic ask below. Click-only. */}
      {hasDetailRows && (
        <div className="mt-2 space-y-1">
          {prettyType(tags) && <Row k="Type" v={prettyType(tags)!} />}
          {tags?.['building:levels'] && (
            <Row k="Levels" v={tags['building:levels']} />
          )}
          {addressOf(tags) && <Row k="Address" v={addressOf(tags)!} />}
        </div>
      )}

      {untyped && (
        <div className="border-warning text-base-content mt-2 border-l-2 pl-2 text-[11px] leading-snug">
          Untyped in OpenStreetMap (
          <span className="font-mono">building=yes</span>). 85% of downtown is.
          Tag it and it appears here on the next load.
        </div>
      )}
    </div>
  );
}
