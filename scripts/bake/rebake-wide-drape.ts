/**
 * Re-fetch and re-slice ONLY the wide aerial drape for one site (#1176).
 *
 * WHY THIS EXISTS RATHER THAN `pnpm bake`. A full bake re-fetches OSM, Microsoft
 * heights, 3DEP terrain and a LiDAR EPT tree, rebuilds the scene and rewrites
 * every derived artifact. Changing `wideMpp` touches exactly one image, and
 * regenerating fifteen others to ship it means every one of them is a diff to
 * review and a chance for an unrelated upstream to have moved underneath you.
 *
 * It reproduces run.ts's wide path exactly — same projection, same atomic copy
 * into OUT, same slice parameters — because the tiles' world rectangles are
 * only meaningful against the projection that produced the raster.
 */
import { cpSync, existsSync, statSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { join } from 'node:path';
import { createProjection } from './enu';
import { fetchDrape, drapePixelSize } from './fetch-drape';
import { sliceDrape } from './slice-drape';
import { loadSiteConfig, sitePaths, atlasBoxFor } from './site-config';

async function main() {
  const slug = process.argv[2] ?? 'chatt';
  const dryRun = process.argv.includes('--dry-run');

  const site = loadSiteConfig(slug);
  const paths = sitePaths(site);
  const atlasBox = atlasBoxFor(site);
  if (atlasBox === site.box) {
    console.error(`${slug} has no atlasBox — nothing wide to bake.`);
    process.exit(1);
  }
  const wideProj = createProjection(atlasBox, site.vectorOffsetM);
  const { width, height } = drapePixelSize(wideProj, site.wideMpp);
  const mp = (width * height) / 1e6;
  const { widthM, depthM } = wideProj.groundSize();

  console.log(`site         ${slug}`);
  console.log(`wideMpp      ${site.wideMpp}`);
  console.log(`extent       ${widthM.toFixed(0)} x ${depthM.toFixed(0)} m`);
  console.log(`raster       ${width} x ${height} = ${mp.toFixed(1)} MP`);
  console.log(
    `E-W / N-S    ${(widthM / width).toFixed(4)} / ${(depthM / height).toFixed(4)} m/px`
  );

  // sharp's default limitInputPixels. The stitch canvas, the slice read and the
  // classifier all go through it, and the failure is an opaque "Input image
  // exceeds pixel limit" several minutes into a fetch that has already happened.
  const SHARP_LIMIT = 268_402_689;
  if (width * height > SHARP_LIMIT) {
    console.error(
      `\nREFUSING: ${mp.toFixed(1)} MP exceeds sharp's default limitInputPixels ` +
        `(${(SHARP_LIMIT / 1e6).toFixed(1)} MP). Raise wideMpp, or raise the limit ` +
        `deliberately and budget for a ${((width * height * 3) / 2 ** 30).toFixed(2)} GB canvas.`
    );
    process.exit(1);
  }
  if (dryRun) {
    console.log('\n--dry-run: nothing fetched.');
    process.exit(0);
  }

  console.log('\n[rebake] fetch-drape (wide)...');
  console.log(
    await fetchDrape(
      paths.raw,
      wideProj,
      site.wideMpp,
      site.drapeSource,
      'drape-wide.jpg'
    )
  );

  const src = join(paths.raw, 'drape-wide.jpg');
  if (!existsSync(src)) throw new Error(`no ${src} after fetch`);
  cpSync(src, join(paths.out, 'drape-wide.jpg'));
  console.log('[rebake] copied into OUT');

  console.log('[rebake] slice-drape (wide)...');
  console.log(
    await sliceDrape(paths.out, widthM / 2, depthM / 2, {
      filename: 'drape-wide.jpg',
      dir: 'drape-wide',
      manifestName: 'drape-wide-tiles.json',
      maxPx: 1024,
    })
  );

  /**
   * SHRINK THE FALLBACK. Slicing is done, so the full-resolution stitch has
   * served its purpose — and leaving it in place is actively wrong twice over.
   *
   * It cannot be used. `drape-wide.jpg` is what `WideCity` loads when tiles are
   * missing, and it loads it as ONE texture. At 16423px it exceeds every GPU
   * limit in existence, so the fallback path would fail on the exact devices it
   * exists to serve — and a texture a device cannot take draws a BLACK ground
   * with no error anywhere.
   *
   * And it is enormous. 50 MB, committed, permanently, since JPEGs do not
   * delta-compress — to hold a picture nothing can display.
   *
   * 4096 rather than the 8192 WebGL guarantees: this is the fallback, so it
   * should clear the floor of the floor. Blur is the whole point of a fallback;
   * it only renders when the tiles could not be had.
   */
  const FALLBACK_MAX_PX = 4096;
  const before = statSync(join(paths.out, 'drape-wide.jpg')).size;
  const shrunk = await sharp(join(paths.out, 'drape-wide.jpg'))
    .resize({
      width: FALLBACK_MAX_PX,
      height: FALLBACK_MAX_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toBuffer();
  const meta = await sharp(shrunk).metadata();
  writeFileSync(join(paths.out, 'drape-wide.jpg'), shrunk);
  console.log(
    `[rebake] fallback shrunk to ${meta.width}x${meta.height}, ` +
      `${(before / 1048576).toFixed(1)} MB -> ${(shrunk.length / 1048576).toFixed(2)} MB`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
