#!/usr/bin/env node
// A stand-in for App Store Connect, so the claim tool's failure paths can be
// exercised without an Apple account. Scenario is chosen by env var.
//
//   SCENARIO=fresh     bundle id absent, app absent   -> tool should exit 4
//   SCENARIO=resume    bundle id present, app present -> tool should exit 0
//   SCENARIO=taken     name PATCH refused with 409    -> tool should exit 1
//   SCENARIO=mismatch  app bound to a different bundle id -> tool should exit 1
import { createServer } from 'node:http';

const S = process.env.SCENARIO || 'fresh';
const BID = 'com.example.app';
const seen = { postedBundle: false };

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  // Every request must carry a three-part ES256 bearer. A tool that forgot to
  // sign would otherwise sail through the whole harness.
  const auth = req.headers.authorization || '';
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) {
    return send(res, 401, {
      errors: [{ title: 'UNAUTHORIZED', detail: 'bad or missing JWT' }],
    });
  }

  if (p === '/v1/bundleIds' && req.method === 'GET') {
    const present = S !== 'fresh' || seen.postedBundle;
    return send(res, 200, {
      data: present
        ? [
            {
              type: 'bundleIds',
              id: 'B1',
              attributes: { identifier: BID, seedId: 'TEAMID123' },
            },
          ]
        : [],
    });
  }
  if (p === '/v1/bundleIds' && req.method === 'POST') {
    seen.postedBundle = true;
    return send(res, 201, {
      data: {
        type: 'bundleIds',
        id: 'B1',
        attributes: { identifier: BID, seedId: 'TEAMID123' },
      },
    });
  }
  if (p === '/v1/apps' && req.method === 'GET') {
    if (S === 'fresh') return send(res, 200, { data: [] });
    const bound = S === 'mismatch' ? 'com.somebody.else' : BID;
    return send(res, 200, {
      data: [
        { type: 'apps', id: '6800000001', attributes: { bundleId: bound } },
      ],
    });
  }
  if (/^\/v1\/apps\/[^/]+\/appInfos$/.test(p)) {
    return send(res, 200, { data: [{ type: 'appInfos', id: 'AI1' }] });
  }
  if (/^\/v1\/appInfos\/[^/]+\/appInfoLocalizations$/.test(p)) {
    return send(res, 200, {
      data: [
        {
          type: 'appInfoLocalizations',
          id: 'L1',
          attributes: { locale: 'en-US', name: 'Old Name' },
        },
      ],
    });
  }
  if (/^\/v1\/appInfoLocalizations\/[^/]+$/.test(p) && req.method === 'PATCH') {
    if (S === 'taken') {
      return send(res, 409, {
        errors: [
          {
            title: 'ENTITY_ERROR.ATTRIBUTE.INVALID',
            detail: 'The app name you entered is already being used.',
          },
        ],
      });
    }
    return send(res, 200, { data: { id: 'L1', attributes: { name: 'set' } } });
  }
  return send(res, 404, { errors: [{ title: 'NOT_FOUND', detail: p }] });
}).listen(0, '127.0.0.1', function () {
  // Announce the port so the harness can find it.
  console.log(`PORT=${this.address().port}`);
});
