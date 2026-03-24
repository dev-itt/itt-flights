const AENA_DESTINATIONS_URL = 'https://www.aena.es/es/palma-de-mallorca/aerolineas-y-destinos/destinos-aeropuerto.html';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});
}

// --- Name cleaning (rules-based) ---

// Spanish→English dictionary (language translations, NOT route-specific).
// Cities whose name is identical in both languages don't need an entry.
const ES_TO_EN = {
	'ARGEL': 'Algiers', 'ATENAS': 'Athens', 'BOLONIA': 'Bologna',
	'BRUSELAS': 'Brussels', 'BUCAREST': 'Bucharest', 'COLONIA': 'Cologne',
	'COPENHAGUE': 'Copenhagen', 'ESTAMBUL': 'Istanbul', 'ESTOCOLMO': 'Stockholm',
	'ESTRASBURGO': 'Strasbourg', 'FLORENCIA': 'Florence', 'GINEBRA': 'Geneva',
	'HAMBURGO': 'Hamburg', 'HANNOVER': 'Hanover', 'LISBOA': 'Lisbon',
	'LONDRES': 'London', 'LUXEMBURGO': 'Luxembourg', 'MARSELLA': 'Marseille',
	'MILAN': 'Milan', 'MOSCU': 'Moscow', 'MUNICH': 'Munich', 'MUENSTER': 'Munster',
	'NAPOLES': 'Naples', 'PEKÍN': 'Beijing', 'PRAGA': 'Prague', 'ROMA': 'Rome',
	'SEVILLA': 'Seville', 'VARSOVIA': 'Warsaw', 'VENECIA': 'Venice',
	'VIENA': 'Vienna', 'NORTE': 'North', 'SUR': 'South',
};

// Airport-specific names to strip from /sub-airport part (matched as full string).
// These are airport names, NOT city/district names (Gatwick, Luton etc. are kept).
const AIRPORT_ONLY_NAMES = [
	'SCHIPHOL', 'ARLANDA', 'HOUARI BOUMEDIEN', 'EL AROUI',
	'INTERNACIONAL', 'INTERNATIONAL',
];

// Brand casing for airlines with unconventional capitalization.
// Matched by prefix so "EASYJET EUROPE" → "EasyJet Europe".
const BRAND_PREFIX = [
	['EASYJET', 'EasyJet'],
	['TUIFLY', 'TUIfly'],
	['JET2', 'Jet2'],
];

function titleCase(str) {
	return str
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => {
			const upper = w.toUpperCase();
			if (ES_TO_EN[upper]) return ES_TO_EN[upper];
			if (['de', 'del', 'la', 'el', 'les', 'di', 'du', 'von', 'van'].includes(w)) return w;
			return w.charAt(0).toUpperCase() + w.slice(1);
		})
		.join(' ');
}

function cleanCity(raw) {
	let name = raw;

	// 1. Strip after first `-` (removes official airport names)
	//    "BARCELONA-EL PRAT JOSEP TARRADELLAS" → "BARCELONA"
	//    "TENERIFE NORTE-C. LA LAGUNA" → "TENERIFE NORTE"
	if (name.includes('-')) {
		name = name.split('-')[0].trim();
	}

	// 2. Remove trailing abbreviations like "F.G.L."
	name = name.replace(/\s+([A-Z]\.){1,4}\s*$/, '').trim();

	// 3. Remove stray parenthetical codes "(FKB)" from double-code patterns
	name = name.replace(/\s*\([A-Z]{3}\)\s*/g, '').trim();

	// 4. Handle `/` sub-airports
	if (name.includes('/')) {
		let [mainCity, subAirport] = name.split(/\s*\/\s*/);
		// Remove "APT." from sub-airport
		subAirport = subAirport.replace(/APT\.?/gi, '').trim();
		// Remove S.ANGELO style prefixes
		subAirport = subAirport.replace(/^S\.\s*/i, '').trim();
		// Check if the entire sub-airport is an airport-only name to strip
		const subUpper = subAirport.toUpperCase().trim();
		const isAirportOnly = !subUpper || AIRPORT_ONLY_NAMES.some((n) => subUpper === n);
		if (isAirportOnly) {
			return titleCase(mainCity);
		}

		const mainClean = titleCase(mainCity);
		const subClean = titleCase(subAirport);

		// Avoid duplication: "London London City" → "London City"
		if (subClean.toLowerCase().startsWith(mainClean.toLowerCase())) {
			return subClean;
		}
		return mainClean + ' ' + subClean;
	}

	return titleCase(name);
}

// ICAO (3-letter) → IATA (2-letter) for airlines with codes in raw AENA data
const ICAO_TO_IATA = {
	'RYR': 'FR', 'RUK': 'RK', 'EZY': 'U2', 'EJU': 'EC',
	'TRA': 'HV', 'NAX': 'DY', 'IBK': 'DY', 'WZZ': 'W6',
};

// Clean name → IATA for airlines WITHOUT ICAO code in raw data
const NAME_TO_IATA = {
	'Aer Lingus': 'EI', 'Air Algerie': 'AH', 'Air Arabia Maroc': '3O',
	'Air Europa': 'UX', 'Air France': 'AF', 'Austrian Airlines': 'OS',
	'BA Euroflyer': 'BA', 'Binter Canarias': 'NT', 'British Airways': 'BA',
	'British Cityflyer': 'BA', 'Brussels Airlines': 'SN', 'Chair Airlines': 'GM',
	'Condor': 'DE', 'Corendon Airlines Europe': 'XR', 'Discover Airlines': '4Y',
	'EasyJet': 'U2', 'EasyJet Europe': 'EC', 'Edelweiss Air': 'WK',
	'Eurowings': 'EW', 'Finnair': 'AY', 'Iberia': 'IB',
	'Iberia Air Nostrum': 'YW', 'Jet Time A/s': 'JO', 'Jet2': 'LS',
	'Leav Aviation': 'LJ', 'Lot Polish': 'LO', 'Lufthansa': 'LH',
	'Lufthansa City Airlines': 'VL', 'Luxair': 'LG', 'Marabu Airlines': 'DI',
	'Norwegian': 'DY', 'Ryanair': 'FR', 'Ryanair Uk': 'RK', 'SAS': 'SK',
	'Smartwings': 'QS', 'Sunclass Airlines': 'DK', 'Sundair': 'SR',
	'Swiftair': 'WT', 'Swiss': 'LX', 'TUIfly': 'X3', 'Transavia': 'HV',
	'Tui Airways': 'BY', 'Tui Fly Belgium': 'TB', 'Volotea': 'V7',
	'Vueling Airlines': 'VY', 'Wizz Air Hungary': 'W6',
};

/**
 * Clean an airline name and resolve its IATA code.
 * @returns {{ name: string, iata: string }}
 */
function cleanAirline(raw) {
	let name = raw;

	// 1. Extract ICAO code from parens before stripping: "RYANAIR (RYR)" → icao=RYR
	let icaoCode = null;
	const icaoMatch = name.match(/\s*\(([A-Z]{3})\)\s*$/);
	if (icaoMatch) {
		icaoCode = icaoMatch[1];
		name = name.replace(icaoMatch[0], '');
	}

	// 2. Strip everything from GMBH onwards (handles "GMBH, LANGENHAGEN" etc.)
	name = name.replace(/[,\s]+GMBH\b.*/i, '');

	// 3. Strip trailing legal forms: AG, OU, AB, S.A., LTD, PLC
	name = name.replace(/\s+(AG|OU|AB|AS|SE|S\.?A\.?|LTD|PLC|INC)\s*$/i, '');

	// 4. Strip ONLY specific noise words that obscure the brand
	//    Do NOT strip "AIRLINES" generically (Austrian Airlines, Discover Airlines need it)
	name = name.replace(/\s+FLUGDIENST\b/i, '');
	name = name.replace(/\s+INTERNATIONAL AIR LINES\b/i, '');

	name = name.trim();

	// 5. Full-name special cases
	const upper = name.toUpperCase();
	let cleanName;
	if (upper === 'SCANDINAVIAN AIRLINES SYSTEM') {
		cleanName = 'SAS';
	}
	// 6. Brand prefix matching (handles "EASYJET", "EASYJET EUROPE", "JET2.COM" etc.)
	else {
		let matched = false;
		for (const [prefix, brand] of BRAND_PREFIX) {
			if (upper === prefix || upper.startsWith(prefix + '.')) { cleanName = brand; matched = true; break; }
			if (upper.startsWith(prefix + ' ')) {
				const rest = name.slice(prefix.length).trim();
				cleanName = brand + ' ' + titleCase(rest);
				matched = true;
				break;
			}
		}
		if (!matched) {
			// 7. Title case with special tokens
			cleanName = name
				.toLowerCase()
				.split(/\s+/)
				.filter(Boolean)
				.map((w) => {
					if (['ba', 'sas'].includes(w)) return w.toUpperCase();
					return w.charAt(0).toUpperCase() + w.slice(1);
				})
				.join(' ');
		}
	}

	// 8. Resolve IATA: first try ICAO mapping, then name mapping
	const iata = (icaoCode && ICAO_TO_IATA[icaoCode]) || NAME_TO_IATA[cleanName] || '';

	return { name: cleanName, iata };
}

// --- HTML Parsing ---

function parseIata(text) {
	const match = text.match(/\(([A-Z]{3})\)\s*$/);
	const city = match ? text.replace(match[0], '').trim() : text.trim();
	return { city, iata: match ? match[1] : null };
}

async function scrapeDestinations() {
	const res = await fetch(AENA_DESTINATIONS_URL, {
		headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AenaPMI-Worker/1.0)' },
	});
	if (!res.ok) throw new Error(`Destinations fetch failed: ${res.status}`);
	const html = await res.text();

	const destinations = [];
	const blockRegex = /<article class="fila resultado[^"]*">([\s\S]*?)<\/article>/gi;
	const titleRegex = /<span class="title bold">([^<]+)<\/span>/i;
	const countryRegex = /<span class="titulo">Pa[ií]s<\/span>\s*<span class="resultado">([^<]+)<\/span>/i;
	const airlineRegex = /<span class="nombre">([^<]+)<\/span>/gi;

	let blockMatch;
	while ((blockMatch = blockRegex.exec(html)) !== null) {
		const block = blockMatch[1];

		const titleMatch = block.match(titleRegex);
		if (!titleMatch) continue;

		const raw = titleMatch[1].trim();
		const { city, iata } = parseIata(raw);

		const countryMatch = block.match(countryRegex);
		const country = countryMatch ? countryMatch[1].trim() : null;

		const airlines = [];
		let airlineMatch;
		while ((airlineMatch = airlineRegex.exec(block)) !== null) {
			airlines.push(airlineMatch[1].trim());
		}

		destinations.push({ city, iata, country, airlines, raw });
	}

	return destinations;
}

async function runScraper(env) {
	const timestamp = new Date().toISOString();
	const results = { timestamp, airport: 'PMI', destinations: [], errors: [] };

	try {
		results.destinations = await scrapeDestinations();
	} catch (e) {
		results.errors.push(`destinations: ${e.message}`);
	}

	await env.AENA_DATA.put('latest_raw', JSON.stringify(results));

	const allAirlinesMap = new Map(); // name → { name, iata }
	const airports = results.destinations.map((d) => {
		const cityClean = cleanCity(d.city);
		const label = d.iata ? `${cityClean} (${d.iata})` : cityClean;
		// cleanAirline now returns { name, iata }
		const rawAirlines = d.airlines.map(cleanAirline);
		// Deduplicate by name (e.g., Norwegian IBK + NAX → one entry)
		const deduped = new Map();
		for (const a of rawAirlines) {
			if (!deduped.has(a.name)) deduped.set(a.name, a);
		}
		const airlines = [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
		airlines.forEach((a) => allAirlinesMap.set(a.name, a));
		return { label, iata: d.iata, country: d.country, airlines };
	});
	airports.sort((a, b) => a.label.localeCompare(b.label));

	const clean = {
		updated: timestamp,
		airport: 'PMI',
		airports,
		airlines: [...allAirlinesMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
	};

	await env.AENA_DATA.put('latest', JSON.stringify(clean));
	const dateKey = timestamp.split('T')[0];
	await env.AENA_DATA.put(`snapshot:${dateKey}`, JSON.stringify(clean));
	await env.AENA_DATA.put(`snapshot_raw:${dateKey}`, JSON.stringify(results));

	return clean;
}

// --- Router ---

function checkAuth(request, env) {
	const key = request.headers.get('x-api-key') || new URL(request.url).searchParams.get('key');
	return key === env.API_KEY;
}

async function handleRequest(request, env) {
	const url = new URL(request.url);
	const path = url.pathname;

	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: CORS_HEADERS });
	}

	if (request.method !== 'GET') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	// Public endpoints: / and /api/status
	// All /api/* endpoints require API key
	if (path.startsWith('/api/') && path !== '/api/status') {
		if (!checkAuth(request, env)) {
			return jsonResponse({ error: 'Unauthorized. Provide x-api-key header or ?key= param.' }, 401);
		}
	}

	if (path === '/api/airports') {
		const data = await env.AENA_DATA.get('latest', 'json');
		if (!data) return jsonResponse({ error: 'No data yet. Trigger /api/scrape first.' }, 404);
		return jsonResponse(data);
	}

	if (path === '/api/airlines') {
		const data = await env.AENA_DATA.get('latest', 'json');
		if (!data) return jsonResponse({ error: 'No data yet. Trigger /api/scrape first.' }, 404);
		return jsonResponse({ updated: data.updated, airlines: data.airlines });
	}

	if (path === '/api/raw') {
		const data = await env.AENA_DATA.get('latest_raw', 'json');
		if (!data) return jsonResponse({ error: 'No data yet. Trigger /api/scrape first.' }, 404);
		return jsonResponse(data);
	}

	if (path.startsWith('/api/snapshot/')) {
		const date = path.replace('/api/snapshot/', '');
		const data = await env.AENA_DATA.get(`snapshot:${date}`, 'json');
		if (!data) return jsonResponse({ error: `No snapshot for ${date}` }, 404);
		return jsonResponse(data);
	}

	if (path === '/api/scrape') {
		const result = await runScraper(env);
		return jsonResponse({ message: 'Scrape completed', ...result });
	}

	if (path === '/api/status') {
		const data = await env.AENA_DATA.get('latest', 'json');
		return jsonResponse({
			service: 'aena-pmi-api',
			airport: 'PMI - Palma de Mallorca',
			lastUpdate: data?.updated || null,
			airportsCount: data?.airports?.length || 0,
			airlinesCount: data?.airlines?.length || 0,
		});
	}

	if (path === '/' || path === '') {
		return jsonResponse({
			service: 'AENA PMI Flight Data API',
			airport: 'PMI - Palma de Mallorca',
			endpoints: {
				'/api/airports': 'Clean airports with airlines (main endpoint)',
				'/api/airlines': 'Deduplicated sorted airline list',
				'/api/raw': 'Raw AENA scraped data',
				'/api/scrape': 'Manually trigger a new scrape',
				'/api/snapshot/:date': 'Historical snapshot (YYYY-MM-DD)',
				'/api/status': 'Service status',
			},
		});
	}

	return jsonResponse({ error: 'Not found' }, 404);
}

export default {
	async fetch(request, env, ctx) {
		return handleRequest(request, env);
	},

	async scheduled(event, env, ctx) {
		ctx.waitUntil(runScraper(env));
	},
};
