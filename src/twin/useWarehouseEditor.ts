'use client';
// The warehouse-editor surface (#259), extracted from TwinCanvasInner
// (iter-4 review A1 — it had grown into a 984-line god-component). Owns:
// edit-mode state (dock toggle, ?edit alias), selection, live overrides +
// localStorage persistence, the directory data, fly-to, the editor hotkeys,
// and the export/clear actions. TwinCanvasInner keeps camera/scene
// orchestration and consumes this as one bundle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Rig } from '@/stage/Rig';
import type { HudDirectoryGroup } from '@/stage/Hud';
import type {
  TwinPlacementOverride,
  WarehouseModelEntry,
  WarehouseModelsInfo,
} from '@/lib/manifest';

// The dev-only overrides sidecar (scripts/dev/overrides-server.mjs). Fixed
// localhost port; only ever reached when the twin is served from localhost.
const OVERRIDES_SERVER = 'http://127.0.0.1:3099';

/** Pure override-patch semantics — exported for unit tests. */
export function patchOverrides(
  prev: Record<string, TwinPlacementOverride>,
  slug: string,
  patch: TwinPlacementOverride
): Record<string, TwinPlacementOverride> {
  return { ...prev, [slug]: { ...prev[slug], ...patch } };
}

/** Size-aware fly-to framing (#259 iter 5) — pure, exported for tests.
 *  Aims at the model's bbox centre (some sources anchor at a campus corner,
 *  not the building) and scales the orbit radius to the model's extent: a
 *  statue and a 700 m bridge should not get the same 80 m frame. Falls back
 *  to the fixed iter-4 radii when the emitted entry carries no dimensions. */
export function flyToFrame(
  entry: Pick<
    WarehouseModelEntry,
    'x' | 'z' | 'yawDeg' | 'scale' | 'dim' | 'centerOffset'
  >,
  ov: TwinPlacementOverride | undefined,
  editMode: boolean
): { x: number; z: number; radius: number } {
  const scale = ov?.scale ?? entry.scale ?? 1;
  let x = entry.x + (ov?.dx ?? 0);
  let z = entry.z + (ov?.dz ?? 0);
  if (entry.centerOffset) {
    // Rotate the local bbox-centre offset by the effective yaw (three.js +Y
    // rotation: +X swings toward −Z for positive yaw), then scale.
    const yaw = (((ov?.yawDeg ?? entry.yawDeg ?? 0) * Math.PI) / 180) * 1;
    const [ox, oz] = entry.centerOffset;
    x += (ox * Math.cos(yaw) + oz * Math.sin(yaw)) * scale;
    z += (-ox * Math.sin(yaw) + oz * Math.cos(yaw)) * scale;
  }
  let radius = editMode ? 80 : 140;
  if (entry.dim) {
    const span = Math.max(entry.dim[0], entry.dim[2]) * scale;
    radius = Math.min(600, Math.max(60, span * (editMode ? 1.2 : 1.8)));
  }
  return {
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
    radius: Math.round(radius),
  };
}

export function resetOverride(
  prev: Record<string, TwinPlacementOverride>,
  slug: string
): Record<string, TwinPlacementOverride> {
  const next = { ...prev };
  delete next[slug];
  return next;
}

/** Parse the persisted overrides blob — v1 envelope `{v, overrides}` or the
 *  legacy bare map; anything unparseable degrades to empty. Pure, exported
 *  for unit tests. */
export function parseStoredOverrides(
  raw: string | null
): Record<string, TwinPlacementOverride> {
  try {
    const parsed = JSON.parse(raw ?? '{}');
    if (parsed && typeof parsed === 'object' && 'v' in parsed) {
      return parsed.overrides ?? {};
    }
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function useWarehouseEditor({
  slug,
  warehouseModels,
  requestOrbit,
}: {
  slug: string;
  warehouseModels: WarehouseModelsInfo | null;
  /** Switches the camera dock to orbit mode (fly-to lives on the orbit rig). */
  requestOrbit: () => void;
}) {
  // The Rig registers itself from inside the R3F root (a sibling render tree
  // that mounts after this component's effects) — state, not a ref, so the
  // deep-link effect below re-fires once it arrives instead of racing it.
  const [rig, setRig] = useState<Rig | null>(null);
  const registerRig = useCallback((r: Rig) => setRig(r), []);
  // Edit mode is a dock toggle; ?edit pre-enables it (scripted/deep-link).
  const [editRequested, setEditRequested] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('edit')
  );
  const editMode = editRequested && !!warehouseModels;
  const toggleEdit = useCallback(() => setEditRequested((v) => !v), []);

  const [directoryOpen, setDirectoryOpen] = useState(false);
  const toggleDirectory = useCallback(() => setDirectoryOpen((v) => !v), []);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  /** Which handle set the in-scene gizmo shows (panel Move ⇄ Rotate toggle). */
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>(
    'translate'
  );

  const overridesKey = `twin-edit:${slug}`;
  const [modelOverrides, setModelOverrides] = useState<
    Record<string, TwinPlacementOverride>
  >(() => {
    if (typeof window === 'undefined') return {};
    return parseStoredOverrides(window.localStorage.getItem(overridesKey));
  });
  useEffect(() => {
    if (!editMode) return;
    if (Object.keys(modelOverrides).length === 0) {
      window.localStorage.removeItem(overridesKey);
    } else {
      window.localStorage.setItem(
        overridesKey,
        JSON.stringify({ v: 1, overrides: modelOverrides })
      );
    }
  }, [modelOverrides, editMode, overridesKey]);

  // Live gizmo drag preview (#259 iter 5): display-only values streamed at
  // rAF rate while a handle drags; the committed override state (and thus
  // regrounding/applyOverrides memos) only changes on release.
  const [liveDrag, setLiveDrag] = useState<TwinPlacementOverride | null>(null);
  useEffect(() => setLiveDrag(null), [selectedModel]);

  const directory = useMemo<HudDirectoryGroup[] | undefined>(() => {
    if (!warehouseModels) return undefined;
    const groups =
      warehouseModels.neighborhoods?.map((n) => ({
        key: n.key,
        label: n.label,
        entries: [] as HudDirectoryGroup['entries'],
      })) ?? [];
    const byKey = new Map(groups.map((g) => [g.key, g]));
    const other: HudDirectoryGroup = {
      key: 'other',
      label: 'Other',
      entries: [],
    };
    for (const m of warehouseModels.models) {
      const g = (m.neighborhood && byKey.get(m.neighborhood)) || other;
      g.entries.push({
        slug: m.slug,
        title: m.title,
        creator: m.creator,
        url: m.url,
        rating: m.rating,
        reviewCount: m.reviewCount,
      });
    }
    if (other.entries.length) groups.push(other);
    return groups.filter((g) => g.entries.length > 0);
  }, [warehouseModels]);

  // Fly-to: synchronous — no wall-clock race (review R1). flyTo sets
  // tFocus/tRadius immediately; the orbit-entry effect and Rig.setMode both
  // skip their hard focus/radius reframe while rig.tFocus is pending, so the
  // React mode switch landing afterwards can't clobber the glide. Framing is
  // size-aware (flyToFrame) and skipped when the target is already framed —
  // re-selecting a nearby building shouldn't yank the camera.
  const flyToModel = useCallback(
    (modelSlug: string) => {
      const entry = warehouseModels?.models.find((m) => m.slug === modelSlug);
      if (!entry) return;
      setSelectedModel(modelSlug);
      const f = flyToFrame(entry, modelOverrides[modelSlug], editMode);
      requestOrbit();
      const alreadyFramed =
        rig &&
        Math.hypot(rig.focus.x - f.x, rig.focus.z - f.z) < 5 &&
        Math.abs(rig.tRadius - f.radius) < 0.2 * f.radius;
      if (!alreadyFramed) rig?.flyTo(f.x, f.z, f.radius);
    },
    [warehouseModels, modelOverrides, requestOrbit, rig, editMode]
  );

  // Generic camera jump for non-model HUD actions (e.g. the embedded twin's
  // in-diorama fly-to, #332). flyToModel's tail without the model selection —
  // a pure pivot glide to an ENU (x,z) at an optional radius. Synchronous for
  // the same reason (sets tFocus/tRadius before the mode switch can clobber).
  const flyTo = useCallback(
    (x: number, z: number, radius?: number) => {
      requestOrbit();
      rig?.flyTo(x, z, radius);
    },
    [requestOrbit, rig]
  );

  const patchOverride = useCallback(
    (patch: TwinPlacementOverride) => {
      if (!selectedModel) return;
      setModelOverrides((prev) => patchOverrides(prev, selectedModel, patch));
    },
    [selectedModel]
  );

  const resetSelected = useCallback(() => {
    if (!selectedModel) return;
    setModelOverrides((prev) => resetOverride(prev, selectedModel));
  }, [selectedModel]);

  const clearAll = useCallback(() => setModelOverrides({}), []);

  /** Copies the overrides JSON; returns false (and logs the JSON to the
   *  console as a fallback channel) when the clipboard write is refused —
   *  the panel must not show "Copied ✓" for a rejected write. */
  const exportOverrides = useCallback(async () => {
    const json = JSON.stringify(modelOverrides, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      return true;
    } catch {
      console.log('[twin-edit] clipboard refused — overrides JSON:\n' + json);
      return false;
    }
  }, [modelOverrides]);

  // Local dev save-to-file (#259 iter 6): in EDIT mode on localhost, probe the
  // dev overrides sidecar (scripts/dev/overrides-server.mjs). When it answers,
  // the editor can write edits straight into overrides-<site>.json so the next
  // bake picks them up — no export/paste. On the static live site the sidecar
  // isn't there (a browser can't write repo files), so the Save button never
  // appears and localStorage remains the only persistence. Gated on editMode
  // so a normal (non-edit) twin load never fires the probe — no stray
  // ERR_CONNECTION_REFUSED on the common path, only when someone is editing.
  const [saveAvailable, setSaveAvailable] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !editMode) return;
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    let alive = true;
    fetch(`${OVERRIDES_SERVER}/health`)
      .then((r) => r.ok)
      .then((ok) => alive && setSaveAvailable(ok))
      .catch(() => {}); // sidecar not running → button stays hidden
    return () => {
      alive = false;
    };
  }, [editMode]);

  /** Write the current overrides straight into overrides-<site>.json via the
   *  dev sidecar. Returns true on success. */
  const saveToFile = useCallback(async () => {
    try {
      const res = await fetch(`${OVERRIDES_SERVER}/twin-overrides/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelOverrides),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [modelOverrides, slug]);

  // Hold the camera on the selected building (suppresses idle-drift, R2).
  useEffect(() => {
    if (!rig) return;
    rig.holdFocus = !!selectedModel;
    return () => {
      rig.holdFocus = false;
    };
  }, [selectedModel, rig]);

  // ?select=<slug> deep-link (the QC sheet's "open in viewer"). One-shot,
  // but only once BOTH the layer and the rig exist — the fly-to needs them.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !warehouseModels || !rig) return;
    const sel = new URLSearchParams(window.location.search).get('select');
    if (!sel) return;
    deepLinked.current = true;
    flyToModel(sel);
  }, [warehouseModels, rig, flyToModel]);

  // Editor hotkeys (arrows/brackets/-=/Escape — the Rig owns WASD;
  // digits/backquote stay in the shell's listener). Current overrides read
  // through a ref so the listener binds once per selection instead of
  // re-subscribing on every nudge.
  const overridesRef = useRef(modelOverrides);
  overridesRef.current = modelOverrides;
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Escape') {
        setSelectedModel(null);
        return;
      }
      if (!selectedModel) return;
      const ov = overridesRef.current[selectedModel] ?? {};
      const nudge = e.shiftKey ? 2 : 0.5;
      if (e.code === 'BracketLeft')
        patchOverride({ yawDeg: (ov.yawDeg ?? 0) - (e.shiftKey ? 15 : 1) });
      else if (e.code === 'BracketRight')
        patchOverride({ yawDeg: (ov.yawDeg ?? 0) + (e.shiftKey ? 15 : 1) });
      else if (e.code === 'Minus')
        patchOverride({
          yOffset: Math.round(((ov.yOffset ?? 0) - 0.25) * 100) / 100,
        });
      else if (e.code === 'Equal')
        patchOverride({
          yOffset: Math.round(((ov.yOffset ?? 0) + 0.25) * 100) / 100,
        });
      else if (e.code === 'ArrowLeft')
        patchOverride({ dx: Math.round(((ov.dx ?? 0) - nudge) * 10) / 10 });
      else if (e.code === 'ArrowRight')
        patchOverride({ dx: Math.round(((ov.dx ?? 0) + nudge) * 10) / 10 });
      else if (e.code === 'ArrowUp')
        patchOverride({ dz: Math.round(((ov.dz ?? 0) - nudge) * 10) / 10 });
      else if (e.code === 'ArrowDown')
        patchOverride({ dz: Math.round(((ov.dz ?? 0) + nudge) * 10) / 10 });
      else return;
      if (e.code.startsWith('Arrow')) e.preventDefault(); // no page scroll
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, selectedModel, patchOverride]);

  return {
    registerRig,
    editMode,
    toggleEdit,
    directory,
    directoryOpen,
    toggleDirectory,
    selectedModel,
    setSelectedModel,
    gizmoMode,
    setGizmoMode,
    modelOverrides,
    liveDrag,
    setLiveDrag,
    patchOverride,
    resetSelected,
    clearAll,
    exportOverrides,
    saveAvailable,
    saveToFile,
    flyToModel,
    flyTo,
  };
}
