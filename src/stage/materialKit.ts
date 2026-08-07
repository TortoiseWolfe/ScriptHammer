import { MeshStandardMaterial, SRGBColorSpace, Texture } from 'three';

export const materialKit = {
  standard(color: number, opts: Partial<MeshStandardMaterial> = {}) {
    return new MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      ...opts,
    });
  },
  drapedGround(texture: Texture, anisotropy = 1) {
    texture.colorSpace = SRGBColorSpace;
    // Anisotropic filtering keeps the aerial imagery sharp at the grazing angles
    // you see at street level (default 1 = a smeared mip). Caller passes the
    // renderer's max.
    texture.anisotropy = Math.max(texture.anisotropy, anisotropy);
    texture.needsUpdate = true;
    return new MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    });
  },
};
