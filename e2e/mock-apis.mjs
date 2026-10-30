#!/usr/bin/env node
/**
 * Servidor simulado do WoRMS e do GBIF para os testes E2E. Responde com as
 * respostas reais gravadas em tests/fixtures/apis, para que os testes não
 * dependam da disponibilidade das APIs externas. Também simula falhas.
 *
 * Rotas (porta 4010):
 *   /worms/AphiaRecordsByName/:nome      (nome com "Falha" → HTTP 500)
 *   /worms/AphiaRecordByAphiaID/:id
 *   /worms/AphiaVernacularsByAphiaID/:id
 *   /gbif/v1/species/match?name=...
 *   /gbif/v1/species/:key
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.MOCK_APIS_PORT ?? 4010);

function load(name) {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../tests/fixtures/apis/${name}`, import.meta.url)), 'utf8'),
  );
}

const cheloniaRecords = load('worms-chelonia-mydas.json');
const carcharodonRecords = load('worms-carcharodon-parcial.json');
const vernaculars = load('worms-vernaculares-137206.json');
const gbifChelonia = load('gbif-match-chelonia-mydas.json');
const gbifCarcharodon = load('gbif-match-carcharodon.json');
const gbifNone = load('gbif-match-inexistente.json');

const recordsById = new Map(
  [...cheloniaRecords, ...carcharodonRecords].map((record) => [record.AphiaID, record]),
);

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);

  if (path === '/health') return send(res, 200, { ok: true });

  let match = /^\/worms\/AphiaRecordsByName\/(.+)$/.exec(path);
  if (match) {
    const name = match[1].toLowerCase();
    if (name.includes('falha')) return send(res, 500, { error: 'simulado' });
    if (name.startsWith('chelonia mydas')) return send(res, 200, cheloniaRecords);
    if (name.startsWith('carcharodon')) return send(res, 200, carcharodonRecords);
    return send(res, 204);
  }

  match = /^\/worms\/AphiaRecordByAphiaID\/(\d+)$/.exec(path);
  if (match) {
    const record = recordsById.get(Number(match[1]));
    return record ? send(res, 200, record) : send(res, 204);
  }

  match = /^\/worms\/AphiaVernacularsByAphiaID\/(\d+)$/.exec(path);
  if (match) return Number(match[1]) === 137206 ? send(res, 200, vernaculars) : send(res, 204);

  if (path === '/gbif/v1/species/match') {
    const name = (url.searchParams.get('name') ?? '').toLowerCase();
    if (name.includes('falha')) return send(res, 503, { error: 'simulado' });
    if (name.startsWith('chelonia mydas')) return send(res, 200, gbifChelonia);
    if (name.startsWith('carcharodon')) return send(res, 200, gbifCarcharodon);
    return send(res, 200, gbifNone);
  }

  match = /^\/gbif\/v1\/species\/(\d+)$/.exec(path);
  if (match && Number(match[1]) === gbifChelonia.usageKey) {
    // Mesmo registro da correspondência, no formato do endpoint /species/{key}.
    return send(res, 200, {
      key: gbifChelonia.usageKey,
      scientificName: gbifChelonia.scientificName,
      canonicalName: gbifChelonia.canonicalName,
      rank: gbifChelonia.rank,
      taxonomicStatus: gbifChelonia.status,
      kingdom: gbifChelonia.kingdom,
      phylum: gbifChelonia.phylum,
      class: gbifChelonia.class,
      family: gbifChelonia.family,
      genus: gbifChelonia.genus,
    });
  }

  return send(res, 404, { error: 'rota não simulada' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`APIs simuladas em http://127.0.0.1:${PORT}`);
});
