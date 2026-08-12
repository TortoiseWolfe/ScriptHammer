/**
 * A rejected promise passed to respondWith becomes an opaque browser network
 * error. It was the reason a client-side Blog navigation rendered index.txt
 * instead of the page (#450), so survey output is not enough: the source needs
 * a mechanical guard.
 *
 * This is a node:test script rather than a Vitest test in tests/unit on
 * purpose. The required Test check runs test:scripts, and e2e.yml explicitly
 * excludes scripts/__tests__ while a tests/unit-only PR spends a Supabase E2E
 * quota run. The guard reads static source and needs neither a browser nor a
 * service, so keeping it on that path is the narrowest correct scope.
 *
 * Parse with TypeScript's AST rather than looking for ".catch(" text. Comments
 * and string literals can contain that text, which would make a text scan pass
 * without any executable failure handler. Trace only expressions returned to
 * the response promise too: a catch used for cache-writing side effects cannot
 * recover a rejected respondWith promise.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CURRENT_WORKER = path.join(REPO_ROOT, 'public', 'sw.js');
const PRE_450_FIXTURE = path.join(
  __dirname,
  'sw-pre-450-respond-with.fixture.js'
);

function parseSource(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  assert.deepStrictEqual(
    sourceFile.parseDiagnostics,
    [],
    fileName + ' must parse before its respondWith handlers can be checked'
  );
  return sourceFile;
}

function findCallExpressions(node, predicate) {
  const matches = [];

  function visit(candidate) {
    if (ts.isCallExpression(candidate) && predicate(candidate)) {
      matches.push(candidate);
    }
    ts.forEachChild(candidate, visit);
  }

  visit(node);
  return matches;
}

function isEventRespondWith(call) {
  return (
    ts.isPropertyAccessExpression(call.expression) &&
    ts.isIdentifier(call.expression.expression) &&
    call.expression.expression.text === 'event' &&
    call.expression.name.text === 'respondWith'
  );
}

function isCatchCall(call) {
  return (
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === 'catch' &&
    call.arguments.length > 0
  );
}

function isCachesMatchCall(call) {
  return (
    ts.isPropertyAccessExpression(call.expression) &&
    ts.isIdentifier(call.expression.expression) &&
    call.expression.expression.text === 'caches' &&
    call.expression.name.text === 'match'
  );
}

function isDeadCacheMatchCatch(call) {
  return (
    isCatchCall(call) &&
    ts.isPropertyAccessExpression(call.expression) &&
    ts.isCallExpression(call.expression.expression) &&
    isCachesMatchCall(call.expression.expression)
  );
}

function isFunctionCallback(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function callbackReturnPaths(callback, parentVariables) {
  if (!ts.isBlock(callback.body)) {
    return [{ expression: callback.body, variables: new Map(parentVariables) }];
  }

  const variables = new Map(parentVariables);
  for (const statement of callback.body.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        variables.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  const paths = [];
  function visit(node) {
    if (ts.isFunctionLike(node)) return;

    if (ts.isReturnStatement(node)) {
      if (node.expression) {
        paths.push({ expression: node.expression, variables });
      }
      return;
    }
    ts.forEachChild(node, visit);
  }

  for (const statement of callback.body.statements) {
    visit(statement);
  }
  return paths;
}

function catchCallsFromCallbacks(call, variables, resolving) {
  return call.arguments
    .filter(isFunctionCallback)
    .flatMap((callback) =>
      callbackReturnPaths(callback, variables).flatMap(
        ({ expression, variables: callbackVariables }) =>
          findResponseCatchCalls(
            expression,
            callbackVariables,
            new Set(resolving)
          )
      )
    );
}

/**
 * Return catch calls that can contribute to the promise passed to respondWith.
 *
 * We follow promise chains, callback return values, and local variables used in
 * those returns. We deliberately do not walk arbitrary callback statements:
 * caches.open(...).catch(...) is a side effect, not a recovery path for the
 * response promise.
 */
function findResponseCatchCalls(
  sourceExpression,
  variables = new Map(),
  resolving = new Set()
) {
  if (
    ts.isParenthesizedExpression(sourceExpression) ||
    ts.isAwaitExpression(sourceExpression)
  ) {
    return findResponseCatchCalls(
      sourceExpression.expression,
      variables,
      resolving
    );
  }

  if (ts.isIdentifier(sourceExpression)) {
    if (resolving.has(sourceExpression.text)) return [];

    const initializer = variables.get(sourceExpression.text);
    if (!initializer) return [];

    const nextResolving = new Set(resolving);
    nextResolving.add(sourceExpression.text);
    return findResponseCatchCalls(initializer, variables, nextResolving);
  }

  if (ts.isBinaryExpression(sourceExpression)) {
    return [
      ...findResponseCatchCalls(sourceExpression.left, variables, resolving),
      ...findResponseCatchCalls(sourceExpression.right, variables, resolving),
    ];
  }

  if (ts.isConditionalExpression(sourceExpression)) {
    return [
      ...findResponseCatchCalls(
        sourceExpression.whenTrue,
        variables,
        resolving
      ),
      ...findResponseCatchCalls(
        sourceExpression.whenFalse,
        variables,
        resolving
      ),
    ];
  }

  if (
    !ts.isCallExpression(sourceExpression) ||
    !ts.isPropertyAccessExpression(sourceExpression.expression)
  ) {
    return [];
  }

  const method = sourceExpression.expression.name.text;
  if (method === 'catch') {
    return [
      ...(isCatchCall(sourceExpression) ? [sourceExpression] : []),
      ...catchCallsFromCallbacks(sourceExpression, variables, resolving),
    ];
  }

  if (method === 'then') {
    return [
      ...findResponseCatchCalls(
        sourceExpression.expression.expression,
        variables,
        resolving
      ),
      ...catchCallsFromCallbacks(sourceExpression, variables, resolving),
    ];
  }

  return [];
}

function findRespondWithViolations(sourceText, fileName) {
  const sourceFile = parseSource(sourceText, fileName);
  const handlers = findCallExpressions(sourceFile, isEventRespondWith);

  return handlers.flatMap((handler, index) => {
    const responsePromise = handler.arguments[0];
    const catchCalls = responsePromise
      ? findResponseCatchCalls(responsePromise)
      : [];
    const violations = [];

    if (catchCalls.length === 0) {
      violations.push({ handler: index + 1, kind: 'missing-catch' });
    }
    if (catchCalls.some(isDeadCacheMatchCatch)) {
      violations.push({
        handler: index + 1,
        kind: 'dead-cache-match-catch',
      });
    }
    return violations;
  });
}

describe('public/sw.js respondWith failure paths (#451)', () => {
  it('covers all current handlers and finds no violations', () => {
    const source = fs.readFileSync(CURRENT_WORKER, 'utf8');
    const sourceFile = parseSource(source, CURRENT_WORKER);
    const handlers = findCallExpressions(sourceFile, isEventRespondWith);

    // A parser that stops finding handlers would otherwise report zero
    // violations and look green while guarding nothing.
    assert.strictEqual(handlers.length, 4);
    assert.deepStrictEqual(
      findRespondWithViolations(source, CURRENT_WORKER),
      []
    );
  });

  it('reports both historical #450 failure shapes from a frozen fixture', () => {
    const source = fs.readFileSync(PRE_450_FIXTURE, 'utf8');

    assert.deepStrictEqual(findRespondWithViolations(source, PRE_450_FIXTURE), [
      { handler: 3, kind: 'dead-cache-match-catch' },
      { handler: 4, kind: 'missing-catch' },
    ]);
  });

  it('does not mistake a comment for an executable catch handler', () => {
    const source = [
      'event.respondWith(fetch(request));',
      '// .catch(() => new Response("not executable"))',
    ].join('\n');

    assert.deepStrictEqual(
      findRespondWithViolations(source, 'comment-only.js'),
      [{ handler: 1, kind: 'missing-catch' }]
    );
  });

  it('does not accept a catch call without a callback', () => {
    const source = 'event.respondWith(fetch(request).catch());';

    assert.deepStrictEqual(
      findRespondWithViolations(source, 'empty-catch.js'),
      [{ handler: 1, kind: 'missing-catch' }]
    );
  });

  it('does not accept a side-effect catch as response recovery', () => {
    const source = [
      'event.respondWith(',
      '  fetch(request).then((response) => {',
      "    caches.open('runtime').catch(() => {});",
      '    return response;',
      '  })',
      ');',
    ].join('\n');

    assert.deepStrictEqual(
      findRespondWithViolations(source, 'side-effect-catch.js'),
      [{ handler: 1, kind: 'missing-catch' }]
    );
  });

  it('does not accept a nested helper catch as response recovery', () => {
    const source = [
      'event.respondWith(',
      '  fetch(request).then((response) => {',
      '    function recoverLater() {',
      '      return fetch(request).catch(() => new Response());',
      '    }',
      '    return response;',
      '  })',
      ');',
    ].join('\n');

    assert.deepStrictEqual(
      findRespondWithViolations(source, 'nested-helper-catch.js'),
      [{ handler: 1, kind: 'missing-catch' }]
    );
  });
});
