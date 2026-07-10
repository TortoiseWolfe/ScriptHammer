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
  WarehouseModelsInfo,
} from '@/lib/manifest';

/** Pure override-patch semantics — exported for unit tests. */
export function patchOverrides(
  prev: Record<string, TwinPlacementOverride>,
  slug: string,
  patch: TwinPlacementOverride
): Record<string, TwinPlacementOverride> {
  return { ...prev, [slug]: { ...prev[slug], ...patch } };
}

export function resetOverride(
  prev: Record<string, TwinPlacementOverride>,
  slug: string
): Record<string, TwinPlacementOverride> {
  const next = { ...prev };
  delete next[slug];
  return next;
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
    try {
      return JSON.parse(window.localStorage.getItem(overridesKey) ?? '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (!editMode) return;
    if (Object.keys(modelOverrides).length === 0) {
      window.localStorage.removeItem(overridesKey);
    } else {
      window.localStorage.setItem(overridesKey, JSON.stringify(modelOverrides));
    }
  }, [modelOverrides, editMode, overridesKey]);

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
  // React mode switch landing afterwards can't clobber the glide.
  const flyToModel = useCallback(
    (modelSlug: string) => {
      const entry = warehouseModels?.models.find((m) => m.slug === modelSlug);
      if (!entry) return;
      setSelectedModel(modelSlug);
      const ov = modelOverrides[modelSlug];
      const dx = entry.x + (ov?.dx ?? 0);
      const dz = entry.z + (ov?.dz ?? 0);
      requestOrbit();
      // Editing wants a legible working distance; browsing keeps context.
      rig?.flyTo(dx, dz, editMode ? 80 : 140);
    },
    [warehouseModels, modelOverrides, requestOrbit, rig, editMode]
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

  const exportOverrides = useCallback(async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(modelOverrides, null, 2)
    );
  }, [modelOverrides]);

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

  // Editor hotkeys (arrows/brackets/-= — the Rig owns WASD; digits/backquote
  // stay in the shell's listener).
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!selectedModel) return;
      const ov = modelOverrides[selectedModel] ?? {};
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
  }, [editMode, selectedModel, modelOverrides, patchOverride]);

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
    patchOverride,
    resetSelected,
    clearAll,
    exportOverrides,
    flyToModel,
  };
}
