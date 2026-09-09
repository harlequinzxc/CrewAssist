import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ServerCacheEntry {
  data: any;
  status: number;
  expiresAt: number;
}

const memoryCache = new Map<string, ServerCacheEntry>();

function formatDateLong(isoDate: string): string {
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function validateSyntax(input: string): { valid: boolean; flight: string } {
  if (!input) return { valid: false, flight: '' };
  const sanitized = input.trim().toUpperCase().replace(/\s+/g, '');
  const match = sanitized.match(/^(?:SQ|SIA)?0*(\d{1,4})$/);
  if (!match) return { valid: false, flight: '' };
  const num = parseInt(match[1], 10);
  if (isNaN(num) || num < 1 || num > 9999) return { valid: false, flight: '' };
  return { valid: true, flight: num.toString() };
}

function validateDate(dateStr: string): { valid: boolean; code?: string; message?: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, code: 'BAD_DATE', message: 'A valid YYYY-MM-DD date is required.' };
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
    return { valid: false, code: 'BAD_DATE', message: 'A valid calendar date is required.' };
  }

  // Check against today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dateStr < todayStr) {
    return { valid: false, code: 'BAD_DATE', message: 'Choose an upcoming departure date.' };
  }

  return { valid: true };
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const CABIN_MAPPING: Record<string, { code: string; label: string; short: string }> = {
  FCL: { code: 'FCL', label: 'Suites & First Class', short: 'First' },
  JCL: { code: 'JCL', label: 'Business Class', short: 'Business' },
  SCL: { code: 'SCL', label: 'Premium Economy', short: 'Prem Econ' },
  YCL: { code: 'YCL', label: 'Economy Class', short: 'Economy' },
  FIRST: { code: 'FCL', label: 'Suites & First Class', short: 'First' },
  SUITES: { code: 'FCL', label: 'Suites & First Class', short: 'First' },
  BUSINESS: { code: 'JCL', label: 'Business Class', short: 'Business' },
  PREMIUM_ECONOMY: { code: 'SCL', label: 'Premium Economy', short: 'Prem Econ' },
  ECONOMY: { code: 'YCL', label: 'Economy Class', short: 'Economy' },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let rawFlight = '';
  let rawDate = '';

  if (req.method === 'GET') {
    rawFlight = (req.query.flight || req.query.flightNo || req.query.flightNumber || '') as string;
    rawDate = (req.query.date || req.query.flightDate || '') as string;
  } else if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};
    rawFlight = (body.flight || body.flightNo || body.flightNumber || req.query.flight || '') as string;
    rawDate = (body.date || body.flightDate || req.query.date || '') as string;
  }

  // 1. Syntax Validation
  const syntax = validateSyntax(rawFlight);
  if (!syntax.valid) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_INPUT',
      message: 'A valid flight number and departure date are required.',
    });
  }

  // 2. Date Validation
  const dateVal = validateDate(rawDate);
  if (!dateVal.valid) {
    return res.status(400).json({
      ok: false,
      code: dateVal.code || 'BAD_DATE',
      message: dateVal.message || 'A valid departure date is required.',
    });
  }

  const flightNum = syntax.flight;
  const flightDate = rawDate;
  const cacheKey = `SQ:${flightNum}:${flightDate}`;

  // Check Cache
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(cached.status).json(cached.data);
  }

  // 3. Upstream Call to SQ
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const upstreamRes = await fetch('https://cifp.auto.prod.c0.singaporeair.com/api/getcabin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://inflightmenu.singaporeair.com',
        'Referer': 'https://inflightmenu.singaporeair.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        carrierId: 'SQ',
        flightNumber: flightNum,
        flightDate: flightDate,
        sessionId: generateSessionId(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const errPayload = {
        ok: false,
        code: 'UPSTREAM_HTTP',
        message: 'Singapore Airlines could not verify this flight right now.',
      };
      return res.status(502).json(errPayload);
    }

    let upstreamData: any;
    try {
      upstreamData = await upstreamRes.json();
    } catch {
      const errPayload = {
        ok: false,
        code: 'UPSTREAM_RESPONSE',
        message: 'Singapore Airlines returned an unexpected response.',
      };
      return res.status(502).json(errPayload);
    }

    // Inspect JSON statusCode
    const sc = Number(upstreamData?.statusCode);

    // 101 or 404 = Not Found
    if (sc === 101 || sc === 404) {
      const notFoundPayload = {
        ok: false,
        code: 'NOT_FOUND',
        message: `No Singapore Airlines flight or published menu was found for SQ ${flightNum} on ${formatDateLong(flightDate)}.`,
      };
      // Short cache for not found (3 minutes)
      memoryCache.set(cacheKey, { data: notFoundPayload, status: 404, expiresAt: Date.now() + 3 * 60 * 1000 });
      return res.status(404).json(notFoundPayload);
    }

    // statusCode === 200
    if (sc === 200) {
      const rawCabins: any[] = Array.isArray(upstreamData?.cabinClasses)
        ? upstreamData.cabinClasses
        : Array.isArray(upstreamData?.cabins)
        ? upstreamData.cabins
        : [];

      if (rawCabins.length === 0) {
        const noCabinsPayload = {
          ok: false,
          code: 'NO_CABINS',
          message: 'This flight was found, but no inflight-menu cabins are available yet.',
        };
        memoryCache.set(cacheKey, { data: noCabinsPayload, status: 404, expiresAt: Date.now() + 3 * 60 * 1000 });
        return res.status(404).json(noCabinsPayload);
      }

      const normalizedCabins: Array<{ code: string; label: string; short: string }> = [];
      const seen = new Set<string>();

      for (const c of rawCabins) {
        const codeStr = (typeof c === 'string' ? c : c?.code || c?.name || '').toUpperCase().trim();
        const mapping = CABIN_MAPPING[codeStr];
        if (mapping && !seen.has(mapping.code)) {
          seen.add(mapping.code);
          normalizedCabins.push(mapping);
        }
      }

      if (normalizedCabins.length === 0) {
        const noCabinsPayload = {
          ok: false,
          code: 'NO_CABINS',
          message: 'This flight was found, but no inflight-menu cabins are available yet.',
        };
        return res.status(404).json(noCabinsPayload);
      }

      const successPayload = {
        ok: true,
        data: {
          flight: flightNum,
          displayFlight: `SQ ${flightNum}`,
          flightDate: flightDate,
          aircraftType: upstreamData.aircraftType || upstreamData.aircraft,
          cabins: normalizedCabins,
        },
      };

      // 30 minute cache for verified flights
      memoryCache.set(cacheKey, { data: successPayload, status: 200, expiresAt: Date.now() + 30 * 60 * 1000 });
      return res.status(200).json(successPayload);
    }

    // Any other upstream code
    return res.status(502).json({
      ok: false,
      code: 'UPSTREAM_RESPONSE',
      message: 'Singapore Airlines returned an unexpected response.',
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(504).json({
        ok: false,
        code: 'UPSTREAM_TIMEOUT',
        message: 'Singapore Airlines took too long to respond. Please try again.',
      });
    }

    // Network error
    return res.status(502).json({
      ok: false,
      code: 'UPSTREAM_NETWORK',
      message: 'The Singapore Airlines menu service is temporarily unreachable.',
    });
  }
}
