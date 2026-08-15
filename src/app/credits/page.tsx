import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const metadata: Metadata = {
  // This route claims its own URL (#668).
  alternates: { canonical: '/credits/' },
  openGraph: { url: '/credits/' },
  title: 'Credits & Model Licensing - ScriptHammer',
  description:
    'Every 3D model in the Chattanooga digital twin, its author, and a link to the original — plus what the 3D Warehouse license does and does not permit.',
};

interface ModelEntry {
  slug: string;
  title: string;
  creator: string;
  url: string;
  neighborhood?: string;
}

/**
 * Read the SHIPPED manifest at build time.
 *
 * Generated from `models.json` rather than hand-maintained, so the page cannot drift from
 * what actually renders in the city. A hand-written credits list is a list that is wrong
 * the first time a model is added.
 */
function loadModels(): ModelEntry[] {
  const file = join(
    process.cwd(),
    'public',
    'twins',
    'chatt',
    'models',
    'models.json'
  );
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as
    | { models: ModelEntry[] }
    | ModelEntry[];
  const list = Array.isArray(parsed) ? parsed : parsed.models;
  return [...list].sort(
    (a, b) =>
      a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title)
  );
}

export default function CreditsPage() {
  const models = loadModels();
  const byCreator = new Map<string, ModelEntry[]>();
  for (const m of models) {
    const arr = byCreator.get(m.creator) ?? [];
    arr.push(m);
    byCreator.set(m.creator, arr);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Credits &amp; Model Licensing
        </h1>
      </header>

      <article className="sh-doc">
        <p>
          The <Link href="/chatt/?diorama&walk">Chattanooga digital twin</Link>{' '}
          is built from open data and from {models.length} 3D models published
          on SketchUp&apos;s 3D Warehouse by {byCreator.size} creators. They are
          credited here because they did the work, not because a licence compels
          it — see the licensing note below.
        </p>

        <section className="mb-8">
          <h2>Data sources</h2>
          <ul>
            <li>
              Building footprints and streets —{' '}
              <a href="https://www.openstreetmap.org/copyright">
                © OpenStreetMap contributors
              </a>
              , ODbL
            </li>
            <li>Terrain and lidar — USGS 3DEP (1 m)</li>
            <li>Aerial imagery — TDOT Aerial Surveys</li>
            <li>Building heights — Microsoft Buildings</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2>3D models</h2>
          <p>
            Every model below is linked to its original 3D Warehouse page.
            Selecting a building in the twin (look at it and press <kbd>E</kbd>)
            shows the same credit in place.
          </p>
          {[...byCreator.entries()].map(([creator, entries]) => (
            <div key={creator} className="mb-6">
              <h3>
                {creator}{' '}
                {/* Solid `text-base-content`, not `/70`: the alpha variants measure
                    4.98:1 against a 7:1 AAA gate, which the route-enumerating contrast
                    spec caught the moment this page existed (#411). */}
                <span className="text-base-content text-sm font-normal">
                  ({entries.length} {entries.length === 1 ? 'model' : 'models'})
                </span>
              </h3>
              <ul>
                {entries.map((m) => (
                  <li key={m.slug}>
                    <a href={m.url} rel="noreferrer noopener" target="_blank">
                      {m.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mb-8">
          <h2>Licensing these models yourself</h2>
          <p>
            <strong>This is not legal advice.</strong> ScriptHammer is a
            template meant to be forked, so anyone forking it inherits these
            assets and the questions below. Read the{' '}
            <a
              href="https://embed-3dwarehouse-classic.sketchup.com/tos/"
              rel="noreferrer noopener"
              target="_blank"
            >
              3D Warehouse Terms of Use
            </a>{' '}
            yourself, and take advice if anything turns on it.
          </p>
          <p>What the General Model License permits, in summary:</p>
          <ul>
            <li>
              Downloading, modifying and making derivative works by
              &ldquo;substantially modifying geometry, color, or other
              attributes&rdquo;
            </li>
            <li>
              Incorporating a model into a <em>Combined Work</em> that
              &ldquo;includes substantial additional content to the original
              Model&rdquo;, including commercially
            </li>
          </ul>
          <p>What it restricts:</p>
          <ul>
            <li>
              You may not &ldquo;sell, offer to sell, make or distribute any
              individual Model on a standalone basis&rdquo; unless you are its
              author
            </li>
            <li>
              You may not &ldquo;aggregate any content… for redistribution, or
              use or distribute any content obtained from 3D Warehouse in a
              mapping or geographic application&rdquo;
            </li>
            <li>
              No exact physical reproductions for sale, and no use in a logo
            </li>
          </ul>
          <p>
            That second restriction is worth reading closely before you fork
            this and ship it: a geolocated city map assembled from many
            Warehouse models is close to what it describes, which is why it is
            tracked openly as an unresolved question in{' '}
            <a
              href="https://github.com/TortoiseWolfe/ScriptHammer/issues/714"
              rel="noreferrer noopener"
              target="_blank"
            >
              issue #714
            </a>
            .
          </p>
          <p>
            <strong>Attribution is not required</strong> by that licence — it
            contains no attribution clause. The credits above are courtesy.
          </p>
          <p>
            For anything the licence does not expressly authorise, it directs
            you to request written consent from Trimble at{' '}
            <a href="mailto:3dwarehouse-tou@sketchup.com">
              3dwarehouse-tou@sketchup.com
            </a>
            . If you want a fork with none of this attached, replace the model
            layer with assets you own or that carry a licence permitting
            geographic use.
          </p>
        </section>
      </article>
    </main>
  );
}
