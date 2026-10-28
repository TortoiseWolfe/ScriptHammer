'use client';

/**
 * The house band's stage in a city twin (#1413): a deck, a back wall and seven portrait
 * boards at Ross's Landing, with the band's theme as sound that comes from the stage.
 *
 * Placement is data (`public/twins/<slug>/stage.json`, see ./bandStage/placement.ts) and
 * the deck stands on the ground the twin reports. With no ground sampler there is no
 * stage: a guessed height is how things have shipped underground here before (#651).
 *
 * The portraits are square 512 px pictures with no transparency, so they are framed
 * boards, not cutouts. Each board turns to face the viewer (drei Billboard).
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Billboard, PositionalAudio, useTexture } from '@react-three/drei';
import {
  SRGBColorSpace,
  type PositionalAudio as ThreePositionalAudio,
  type Texture,
} from 'three';
import { ROSTER } from '@/lib/band/roster';
import { getAssetUrl } from '@/config/project.config';
import { siteAssetUrl } from '@/lib/manifest';
import {
  hasStage,
  isNearStage,
  parseStageSpot,
  placeStage,
  type ProjectionInput,
  type StageSpot,
} from './bandStage/placement';

/** The band's theme, the same file /band plays. */
export const STAGE_SONG = '/band/audio/band-wagon-theme.mp3';

// Deck size in metres. Big enough to read from the lawn's edge, small enough to fit the
// lawn (about 40 m north to south at this spot).
const DECK_W = 22;
const DECK_D = 10;
const DECK_H = 1.2;
/** The deck's skirt reaches this far below its lowest corner, so a sloped lawn never
 *  shows a gap under it. */
const SKIRT = 3;
const WALL_H = 7;
const BOARD = 2.4;
const BOARD_GAP = 0.6;

function StageSound({ playing, muted }: { playing: boolean; muted: boolean }) {
  const ref = useRef<ThreePositionalAudio>(null);
  // A child effect runs after drei's own (which sets the buffer), so the sound is ready.
  useEffect(() => {
    const s = ref.current;
    if (!s || !s.buffer) return;
    if (playing && !s.isPlaying) s.play();
    if (!playing && s.isPlaying) s.pause();
  }, [playing]);
  useEffect(() => {
    ref.current?.setVolume(muted ? 0 : 1);
  }, [muted]);
  return (
    <PositionalAudio
      ref={ref}
      url={getAssetUrl(STAGE_SONG)}
      distance={15}
      loop
    />
  );
}

function PortraitBoards({ deckTop }: { deckTop: number }) {
  const urls = useMemo(() => ROSTER.map((m) => getAssetUrl(m.portrait512)), []);
  const textures = useTexture(urls) as Texture[];
  useEffect(() => {
    for (const t of textures) {
      t.colorSpace = SRGBColorSpace;
      t.needsUpdate = true;
    }
  }, [textures]);
  const span = ROSTER.length * BOARD + (ROSTER.length - 1) * BOARD_GAP;
  return (
    <>
      {ROSTER.map((m, i) => (
        <Billboard
          key={m.slug}
          position={[
            -span / 2 + BOARD / 2 + i * (BOARD + BOARD_GAP),
            deckTop + BOARD / 2 + 0.4,
            1,
          ]}
          lockX
          lockZ
          name={`band-member-${m.slug}`}
        >
          {/* The frame, a little larger and just behind the picture. */}
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[BOARD + 0.16, BOARD + 0.16]} />
            <meshStandardMaterial color="#1b1f2a" />
          </mesh>
          <mesh>
            <planeGeometry args={[BOARD, BOARD]} />
            <meshStandardMaterial map={textures[i]} />
          </mesh>
        </Billboard>
      ))}
    </>
  );
}

export interface BandStageProps {
  slug: string;
  manifest: ProjectionInput;
  /** The twin's ground sampler. Null until the terrain arrives; no stage until then. */
  groundAt: ((x: number, z: number) => number) | null;
  /** Where the walker is, read a few times a second. Null outside Walk. */
  getPlayer: () => { x: number; z: number } | null;
  playing: boolean;
  muted: boolean;
  /** Fires when the walker comes within (or leaves) hearing range. */
  onNear?: (near: boolean) => void;
  onError?: (message: string) => void;
}

export default function BandStage({
  slug,
  manifest,
  groundAt,
  getPlayer,
  playing,
  muted,
  onNear,
  onError,
}: BandStageProps) {
  const [spot, setSpot] = useState<StageSpot | null>(null);

  useEffect(() => {
    if (!hasStage(slug)) return;
    let cancelled = false;
    fetch(siteAssetUrl(slug, 'stage.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`stage.json: HTTP ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((raw) => {
        if (!cancelled) setSpot(parseStageSpot(raw));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          onError?.(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, onError]);

  const placement = useMemo(
    () => (spot ? placeStage(spot, manifest) : null),
    [spot, manifest]
  );

  // The deck's footing: the highest ground under its centre and corners, so no corner is
  // buried; the skirt covers the drop to the lowest.
  const base = useMemo(() => {
    if (!placement || !groundAt) return null;
    const c = Math.cos(placement.rotationY);
    const s = Math.sin(placement.rotationY);
    const pts: [number, number][] = [
      [0, 0],
      [-DECK_W / 2, -DECK_D / 2],
      [DECK_W / 2, -DECK_D / 2],
      [-DECK_W / 2, DECK_D / 2],
      [DECK_W / 2, DECK_D / 2],
    ];
    let hi = -Infinity;
    let lo = Infinity;
    for (const [lx, lz] of pts) {
      // Local (lx, lz) turned by rotationY about Y, then moved to the stage.
      const wx = placement.x + lx * c + lz * s;
      const wz = placement.z - lx * s + lz * c;
      const y = groundAt(wx, wz);
      if (!Number.isFinite(y)) return null;
      hi = Math.max(hi, y);
      lo = Math.min(lo, y);
    }
    return { y: hi, drop: hi - lo };
  }, [placement, groundAt]);

  // Near or far, polled at 4 Hz like the location readout; React only hears changes.
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!placement) return;
    const tick = () => {
      const p = getPlayer();
      setNear(p ? isNearStage(placement, p.x, p.z) : false);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [placement, getPlayer]);
  useEffect(() => {
    onNear?.(near);
  }, [near, onNear]);
  useEffect(() => () => onNear?.(false), [onNear]);

  // The song loads once the walker is close or presses play, then stays loaded.
  const [wantSound, setWantSound] = useState(false);
  useEffect(() => {
    if (near || playing) setWantSound(true);
  }, [near, playing]);

  if (!placement || !base) return null;
  const skirt = SKIRT + base.drop;
  const deckTop = DECK_H;

  return (
    <group
      name="band-stage"
      position={[placement.x, base.y, placement.z]}
      rotation={[0, placement.rotationY, 0]}
    >
      {/* Deck: its top is DECK_H above the highest ground under it. */}
      <mesh position={[0, (DECK_H - skirt) / 2, 0]}>
        <boxGeometry args={[DECK_W, DECK_H + skirt, DECK_D]} />
        <meshStandardMaterial color="#2a2f3a" roughness={0.9} />
      </mesh>
      {/* Back wall, along the rear edge (the front faces +Z). */}
      <mesh position={[0, deckTop + WALL_H / 2, -DECK_D / 2 + 0.3]}>
        <boxGeometry args={[DECK_W, WALL_H, 0.6]} />
        <meshStandardMaterial color="#141822" roughness={0.8} />
      </mesh>
      {/* A lit strip along the deck's front edge so the stage reads from the lawn. */}
      <mesh position={[0, deckTop + 0.05, DECK_D / 2 - 0.2]}>
        <boxGeometry args={[DECK_W, 0.1, 0.3]} />
        <meshStandardMaterial
          color="#f2b84b"
          emissive="#f2b84b"
          emissiveIntensity={1.5}
        />
      </mesh>
      {/* Speaker stacks at both front corners. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (DECK_W / 2 - 1), deckTop + 2, DECK_D / 2 - 1]}
        >
          <boxGeometry args={[1.6, 4, 1.4]} />
          <meshStandardMaterial color="#0d0f14" roughness={0.6} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <PortraitBoards deckTop={deckTop} />
      </Suspense>
      {wantSound && (
        <group position={[0, deckTop + 3, 0]}>
          <Suspense fallback={null}>
            <StageSound playing={playing} muted={muted} />
          </Suspense>
        </group>
      )}
    </group>
  );
}
