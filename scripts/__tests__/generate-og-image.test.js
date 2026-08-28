/**
 * The social card must be derived from the project's own name (#988 follow-up).
 *
 * `public/opengraph-image.png` is 1200x630 of this template's lockup, and it is what
 * Slack, LinkedIn and iMessage render when anyone pastes a fork's link. Every fork
 * inherited it — the same borrowed artwork #988 removed from the hero, on the surface
 * that reaches people who never open the site.
 *
 * These test the pure builders, not the raster: sharp is an optional dependency of the
 * rebrand path, and a test that needs it would not run where the failure matters.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const MOD = new URL('../generate-og-image.mjs', `file://${__filename}`).href;

describe('social card derivation', () => {
  test('initials come from the first two words', async () => {
    const { initialsOf } = await import(MOD);
    assert.strictEqual(initialsOf('Grand Daze'), 'GD');
    assert.strictEqual(initialsOf('grand-daze'), 'GD');
    assert.strictEqual(initialsOf('widget'), 'W');
    assert.strictEqual(initialsOf('My Cool App'), 'MC');
  });

  test('a nameless project still renders something rather than crashing', async () => {
    const { initialsOf } = await import(MOD);
    assert.strictEqual(initialsOf(''), '?');
    assert.strictEqual(initialsOf('   '), '?');
  });

  test('the card carries the project name and nothing borrowed', async () => {
    const { cardSvg } = await import(MOD);
    const svg = cardSvg('Grand Daze');
    assert.match(svg, /Grand Daze/);
    assert.match(svg, />GD</);
    // The whole point. A generated card cannot contain another project's identity.
    assert.ok(!/scripthammer/i.test(svg), 'the card names another project');
    assert.ok(!/mallet|gear/i.test(svg), 'the card draws borrowed artwork');
  });

  test('it invents no tagline or description', async () => {
    const { cardSvg } = await import(MOD);
    const svg = cardSvg('Grand Daze');
    // Two text nodes only: the initials and the name. A script cannot know what a
    // project does, and guessing is how a template ships someone a false promise.
    assert.strictEqual((svg.match(/<text/g) || []).length, 2);
  });

  test('a name with XML metacharacters cannot break the document', async () => {
    const { cardSvg } = await import(MOD);
    // A project name is free text a forker supplies — the same class of input that
    // crashed the rebrand through sed once already.
    const svg = cardSvg("Ben & Jerry's <script>");
    assert.ok(!/<script>/.test(svg), 'raw markup reached the SVG');
    assert.match(svg, /&amp;/);
    assert.match(svg, /&lt;script&gt;/);
  });

  test('the canvas is the size the platforms actually render', async () => {
    const { cardSvg } = await import(MOD);
    const svg = cardSvg('Anything');
    assert.match(svg, /width="1200"/);
    assert.match(svg, /height="630"/);
  });
});
