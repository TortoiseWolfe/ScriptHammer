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
  drapedGround(texture: Texture) {
    texture.colorSpace = SRGBColorSpace;
    return new MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    });
  },
};
