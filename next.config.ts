import type { NextConfig } from 'next';
import { execSync } from 'child_process';

// Run project detection at build time
function detectProjectConfig() {
  try {
    // Run the detection script to generate config files
    execSync('node scripts/detect-project.js', { stdio: 'inherit' });
  } catch {
    console.warn('Could not run detection script');
  }

  // Use environment variable if set (from .env.local or CI/CD)
  // Treat empty string as undefined to allow auto-detection in forks
  const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  if (envBasePath !== undefined && envBasePath !== '') {
    return envBasePath;
  }

  // Read the auto-detected configuration using require
  try {
    const fs = require('fs');

    const path = require('path');
    const configPath = path.join(
      __dirname,
      'src',
      'config',
      'project-detected.json'
    );
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.basePath || '';
  } catch {
    // Final fallback if detection completely fails
    console.warn('Could not read detected config, using empty base path');
    return '';
  }
}

const basePath = detectProjectConfig();

const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Overridable so a build can put its output somewhere other than .next.
  // ONE live caller: scripts/serve-basepath.sh sets NEXT_DIST_DIR=out-basepath
  // so the basePath-prefixed export (#157) lands ready to symlink-serve —
  // under `output: 'export'` Next 15.5 replaces the distDir with the finished
  // static site and never creates out/, so distDir IS the export dir.
  //
  // It is NOT the answer to "a build racing the dev server". That was
  // scripts/e2e-live-acceptance.sh's use, and an isolated distDir did not stop
  // the corruption — six failures in two days (#508). Builds belong in the
  // `builder` service, which has its own .next volume and no dev server in it.
  // If you are reaching for this to dodge a race, reach for that instead.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  cleanDistDir: true,
  env: {
    NEXT_PUBLIC_PAGESPEED_API_KEY: process.env.NEXT_PUBLIC_PAGESPEED_API_KEY,
    // Deploy workflows omit NEXT_PUBLIC_BASE_PATH and rely on detect-project.js,
    // so the resolved basePath must be injected here or client code that builds
    // URLs (auth redirects) sees '' in production (issue #154).
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  webpack: (config, { isServer, dev }) => {
    // Emit which MODULES ended up in which chunk, so the first-load gate can ask
    // the build a question instead of grepping minified output for a class name.
    //
    // WHY (#636, a #291 follow-up). check-first-load-budget.mjs matched
    // /WebGLRenderer|BufferGeometry/ against emitted JS. On 2026-08-06 an app module
    // gained the log line "no WebGLRenderer available yet", landed in `common`, and
    // the gate reported "three.js ships in 125 non-3D routes". Deploys were blocked
    // for hours over a console.warn. Measured: `common` had 0 BufferGeometry and 1
    // WebGLRenderer; the real three chunk had 42 and 37 and was async-only.
    //
    // A string match cannot tell a library from a log message, and cannot see
    // first-party code at all — so it also MISSED the genuine regression, which is
    // that src/lib/cod (3D-only glue) is now in an always-initial chunk.
    //
    // Module resources are exact: immune to minification, to log strings, and to a
    // three upgrade renaming a class.
    //
    // WHERE IT LANDS, and why not in distDir. The gate runs via
    // `docker compose exec scripthammer` (validate-ci.sh:54) — the DEV container —
    // while the build runs in `builder`, which has its OWN .next volume (#293).
    // A map written to distDir therefore never reaches the process that reads it;
    // the reader would see the dev server's .next instead, where three has never
    // been compiled (dev builds routes on demand). Only the repo root and out/
    // cross that boundary, which is why the old gate read out/ exclusively.
    //
    // PRODUCTION ONLY. If `next dev` also wrote here it would clobber the real
    // build's map with a partial one, and a partial map that looks complete is the
    // failure mode this whole change exists to remove.
    const MAP_FILE = '.chunk-modules.json';
    if (!isServer && !dev) {
      const { writeFileSync } = require('fs');
      const path = require('path');

      config.plugins.push({
        apply(compiler: {
          hooks: {
            afterEmit: {
              tap: (name: string, fn: (compilation: unknown) => void) => void;
            };
          };
        }) {
          compiler.hooks.afterEmit.tap('emit-chunk-modules', (compilation) => {
            type Mod = {
              resource?: string;
              // ConcatenatedModule (scope hoisting) — see collect() below.
              modules?: Iterable<Mod>;
              rootModule?: Mod;
            };
            const c = compilation as {
              chunks: Iterable<{ files: Set<string>; name?: string }>;
              chunkGraph: {
                getChunkModulesIterable: (chunk: unknown) => Iterable<Mod>;
              };
              getAssets: () => Array<{ name: string }>;
            };
            /** node_modules/... -> the package name; src/... -> repo-relative path. */
            const label = (resource: string): string | null => {
              const norm = resource.split(path.sep).join('/');
              const nm = norm.lastIndexOf('/node_modules/');
              if (nm !== -1) {
                let rest = norm.slice(nm + '/node_modules/'.length);
                // pnpm stores as .pnpm/<pkg>@<ver>/node_modules/<pkg>/...
                if (rest.startsWith('.pnpm/')) {
                  const inner = rest.indexOf('/node_modules/');
                  if (inner === -1) return null;
                  rest = rest.slice(inner + '/node_modules/'.length);
                }
                const parts = rest.split('/');
                return parts[0].startsWith('@')
                  ? `${parts[0]}/${parts[1]}`
                  : parts[0];
              }
              const i = norm.indexOf('/src/');
              return i === -1 ? null : norm.slice(i + 1);
            };

            /**
             * Walk a module, INCLUDING INTO ConcatenatedModule.
             *
             * Production enables `concatenateModules` (scope hoisting), which
             * merges a module group into one synthetic ConcatenatedModule with no
             * `.resource` of its own — the real files hang off `.modules`. Reading
             * only `.resource` therefore sees nothing for most of a prod bundle:
             * measured here, 62 of 89 chunks came back empty, `main-app` among
             * them. Empty is indistinguishable from clean, so that was a hole big
             * enough to hide the very leak this gate exists to catch.
             */
            const collect = (m: Mod, into: Set<string>, depth = 0): void => {
              if (depth > 12) return; // paranoia; the graph is a DAG in practice
              if (m.resource) {
                const l = label(m.resource);
                if (l) into.add(l);
              }
              if (m.rootModule) collect(m.rootModule, into, depth + 1);
              if (m.modules) {
                for (const inner of m.modules) collect(inner, into, depth + 1);
              }
            };

            const out: Record<string, string[]> = {};
            for (const chunk of c.chunks) {
              const labels = new Set<string>();
              for (const m of c.chunkGraph.getChunkModulesIterable(chunk)) {
                collect(m, labels);
              }
              for (const file of chunk.files) {
                if (file.endsWith('.js')) out[file] = [...labels].sort();
              }
            }

            // Assets that are not the output of any chunk — Next ships
            // `polyfills-*.js` this way, listed in build-manifest.polyfillFiles
            // and copied in rather than compiled. It carries no webpack modules,
            // so an empty list is the honest answer. Recording it explicitly is
            // what lets the gate treat "absent from this map" as a hard error
            // instead of shrugging at every file it does not recognise.
            for (const { name } of c.getAssets()) {
              if (name.endsWith('.js') && !(name in out)) out[name] = [];
            }
            try {
              writeFileSync(
                path.join(process.cwd(), MAP_FILE),
                JSON.stringify(out)
              );
            } catch {
              // Never fail a build over the audit file. The gate refuses to pass
              // blind when it is missing, which is the correct place to notice.
            }
          });
        },
      });
    }

    // Optimize code splitting for better performance
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunks for node_modules
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              // JS ONLY (#625). Without this, the group claims node_modules CSS
              // too — webpack treats stylesheets as modules — so the `vendor`
              // chunk held JS *and* 43KB of CSS, webpack emitted both `vendor.js`
              // and `vendor.css` under one chunk name, and the chunk loader wrote
              // `<script src="…/vendor.css">`. The browser then parsed a
              // stylesheet as JavaScript: `SyntaxError: Invalid or unexpected
              // token` on every page load.
              //
              // That is the defect `scripts/strip-css-script-tags.mjs` was written
              // for. It attributes the bug to Next and strips the tags out of the
              // EXPORT, which fixes production and leaves `next dev` throwing on
              // every page — permanent console noise that hides real errors.
              //
              // A REGEX, not the string 'javascript/auto'. Webpack 5 gives ES
              // modules the type `javascript/esm`, so the exact string would
              // quietly stop matching most of the tree and scatter the vendor
              // chunk. `/javascript/` covers auto, esm and dynamic while still
              // excluding `css/mini-extract`.
              type: /javascript/,
              priority: 10,
              reuseExistingChunk: true,
            },
            // Common chunks used across multiple pages
            common: {
              // Do not give this first-party group a fixed name. A fixed name
              // merges every module used by two chunks into one entry-reachable
              // chunk, including code that is only shared by dynamic 3D routes.
              // Let webpack name common chunks by their entrypoint graph instead.
              minChunks: 2,
              type: /javascript/, // same reason as `vendor` (#625)
              priority: 5,
              reuseExistingChunk: true,
            },
            // Heavy libraries in separate chunks.
            //
            // NOT optional. The `vendor` group above has a FIXED name, so
            // webpack merges every node_modules module it claims — async ones
            // included — into ONE chunk, and that chunk is initial because
            // react/next are statically imported everywhere. A `dynamic(...,
            // { ssr: false })` boundary does NOT rescue a library from it.
            // These priority-20 groups are the only reason leaflet/cesium stay
            // off the homepage: they claim their modules before `vendor` (10)
            // can. Delete one and its library silently ships on every route.
            //
            // three.js now has its own group too (#291) — WITHOUT it, all of
            // three + the @react-three/drei ecosystem (three-stdlib, troika-*,
            // meshline, camera-controls, maath, @monogrid/gainmap-js,
            // three-mesh-bvh, stats-gl, @mediapipe/tasks-vision, postprocessing)
            // shipped in the 2.66MB initial vendor chunk on EVERY route.
            leaflet: {
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              name: 'leaflet',
              type: /javascript/, // JS only — see `vendor` (#625)
              priority: 20,
            },
            // `cesium` is a THIN RE-EXPORT SHELL. Since the monorepo split the
            // real code lives in scoped packages — @cesium/engine (28MB),
            // @cesium/widgets, @cesium/wasm-splats — so a
            // /node_modules/cesium/ test matches almost nothing (verified: it
            // caught only widgets.css) and the whole library lands in the
            // initial vendor chunk anyway. The scope is what matters here.
            cesium: {
              test: /[\\/]node_modules[\\/](cesium|@cesium)[\\/]/,
              name: 'cesium',
              type: /javascript/, // JS only — see `vendor` (#625)
              priority: 20,
            },
            // three.js (#291). `three` itself is the real 2.66MB package (not a
            // re-export shell like cesium), but the @react-three/drei/fiber
            // ecosystem pulls a dozen separate top-level packages that each
            // bundle three — ALL must be listed or they stay in `vendor`. The
            // trailing `[\\/]` after `three` matches only the exact `three` dir,
            // not `three-stdlib`/`three-mesh-bvh` (listed explicitly).
            three: {
              test: /[\\/]node_modules[\\/](three|three-stdlib|three-mesh-bvh|@react-three[\\/](fiber|drei)|troika-three-text|troika-three-utils|troika-worker-utils|meshline|camera-controls|maath|@monogrid[\\/]gainmap-js|stats-gl|@mediapipe[\\/]tasks-vision|postprocessing)[\\/]/,
              name: 'three',
              type: /javascript/, // JS only — see `vendor` (#625)
              priority: 20,
            },
          },
        },
      };
    }

    // LET JS IMPORT A .woff2 AND GET ITS FINAL URL (#740).
    //
    // Fonts referenced from CSS `url()` are handled by Next's css-loader and are NOT
    // affected by this: `dependency: { not: ['url'] }` scopes the rule to real ESM
    // imports, so the 34 faces in fonts.generated.css keep emitting exactly as before.
    // Verified by diffing the emitted `_next/static/media` file list against a build
    // without this rule — identical, 34 files, same hashes.
    //
    // It exists so `fonts-preload.generated.ts` can import the eight preloadable faces
    // and hand the bundler's fingerprinted URL to `<link rel="preload">`. A literal URL
    // cannot work: the bundler adds a SECOND hash (`x-s.p.woff2` ships as
    // `x-s.p.1a4aa509.woff2`), so anything hardcoded is stale as soon as a font changes.
    config.module.rules.push({
      test: /\.woff2$/,
      dependency: { not: ['url'] },
      type: 'asset/resource',
      generator: {
        // Match the layout Next already uses for fonts, so nothing else has to learn a
        // second location.
        filename: 'static/media/[name].[hash:8][ext]',
      },
    });

    return config;
  },
};

export default nextConfig;
