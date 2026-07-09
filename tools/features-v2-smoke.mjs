#!/usr/bin/env node

const DEFAULT_API_URL =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_CITY =
  process.env.CITY || process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Cartagena';
const DEFAULT_TIMEOUT_MS = 8_000;

const args = process.argv.slice(2);

function readOption(name, fallback) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) {
    return args[index + 1];
  }

  return fallback;
}

const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const apiUrl = String(readOption('--api-url', DEFAULT_API_URL)).replace(/\/+$/, '');
const city = String(readOption('--city', DEFAULT_CITY)).trim();
const timeoutMs = Number(readOption('--timeout-ms', DEFAULT_TIMEOUT_MS));
const asJson = flags.has('--json');
const dryRun = flags.has('--dry-run');
const help = flags.has('--help') || flags.has('-h');

function usage() {
  return `
Usage:
  npm run smoke:features-v2 -- --api-url http://localhost:3001 --city Cartagena

Options:
  --api-url <url>       Backend URL. Defaults to API_URL or http://localhost:3001.
  --city <name>         Operational city to validate. Defaults to CITY or Cartagena.
  --timeout-ms <ms>     Request timeout per endpoint. Defaults to ${DEFAULT_TIMEOUT_MS}.
  --dry-run             Print checks without calling the API.
  --json                Print machine-readable output.
`;
}

const checks = [
  {
    name: 'categories',
    path: '/categories',
    expected: 'Categorias publicas responden 200',
  },
  {
    name: 'places_by_city',
    path: `/places?city=${encodeURIComponent(city)}&limit=1`,
    expected: 'Listado de lugares acepta city',
  },
  {
    name: 'place_search_by_city',
    path: `/places/search?q=castillo&city=${encodeURIComponent(city)}&limit=1`,
    expected: 'Busqueda de lugares acepta city',
  },
  {
    name: 'nearby_places_by_city',
    path: `/places?sort_by=distance&latitude=10.4&longitude=-75.5&city=${encodeURIComponent(
      city,
    )}&limit=1`,
    expected: 'RPC list_places_near acepta city',
  },
  {
    name: 'ranking_by_city',
    path: `/ranking?city=${encodeURIComponent(city)}`,
    expected: 'Ranking por ciudad responde 200',
  },
  {
    name: 'active_promotions',
    path: '/promotions/active',
    expected: 'Promociones activas responden 200',
  },
  {
    name: 'current_featured',
    path: '/featured/current',
    expected: 'Destacados vigentes/fallback responden 200',
  },
];

function makeUrl(path) {
  return `${apiUrl}${path}`;
}

function isMigrationHint(bodyText) {
  return [
    'column places.city does not exist',
    'column place_rankings.city does not exist',
    'Could not find the function public.list_places_near',
    'schema cache',
  ].some((hint) => bodyText.includes(hint));
}

async function runCheck(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(makeUrl(check.path), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    const bodyText = await response.text();
    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = bodyText;
    }

    return {
      ...check,
      url: makeUrl(check.path),
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      duration_ms: Date.now() - startedAt,
      migration_hint: isMigrationHint(bodyText),
      body,
    };
  } catch (error) {
    return {
      ...check,
      url: makeUrl(check.path),
      ok: false,
      status: null,
      duration_ms: Date.now() - startedAt,
      migration_hint: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printHuman(results) {
  console.log(`Features v2 smoke`);
  console.log(`API: ${apiUrl}`);
  console.log(`City: ${city}`);
  console.log('');

  for (const result of results) {
    if (result.dry_run) {
      console.log(`- DRY ${result.name}: ${result.url}`);
      continue;
    }

    const mark = result.ok ? 'OK ' : 'FAIL';
    const status = result.status ? `status=${result.status}` : 'no-status';
    console.log(
      `- ${mark} ${result.name}: ${status} ${result.duration_ms}ms — ${result.expected}`,
    );

    if (!result.ok && result.migration_hint) {
      console.log('  hint: faltan migraciones Features v2 en la DB conectada.');
    } else if (!result.ok && result.error) {
      console.log(`  error: ${result.error}`);
    } else if (!result.ok && result.body) {
      const message =
        typeof result.body === 'string'
          ? result.body
          : result.body.message || JSON.stringify(result.body);
      console.log(`  body: ${String(message).slice(0, 240)}`);
    }
  }
}

if (help) {
  console.log(usage().trim());
  process.exit(0);
}

if (!city) {
  console.error('Missing city. Pass --city Cartagena or set CITY.');
  process.exit(2);
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('Invalid --timeout-ms value.');
  process.exit(2);
}

const results = dryRun
  ? checks.map((check) => ({
      ...check,
      url: makeUrl(check.path),
      ok: true,
      dry_run: true,
    }))
  : await Promise.all(checks.map(runCheck));

if (asJson) {
  console.log(JSON.stringify({ api_url: apiUrl, city, results }, null, 2));
} else {
  printHuman(results);
}

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  process.exit(failed.some((result) => result.migration_hint) ? 3 : 1);
}
