const CACHE_STORE = "eurojackpot-circle";
const CACHE_KEY = "latest-eurojackpot-result";

const sources = [
  {
    name: "euro-jackpot.net",
    url: "https://www.euro-jackpot.net/results",
    parser: parseEuroJackpotNet,
  },
  {
    name: "eurojackpot.com",
    url: "https://www.eurojackpot.com/en/results/",
    parser: parseGenericHtml,
  },
  {
    name: "lotto.de",
    url: "https://www.lotto.de/de/ergebnisse/eurojackpot.html",
    parser: parseGenericHtml,
  },
];

const fallbackResult = {
  drawDate: "Freitag, 5. Juni 2026",
  numbers: [21, 23, 44, 47, 50],
  euroNumbers: [1, 7],
  jackpot: "27.733.144 EUR",
  source: "Function fallback",
  updatedAt: new Date().toISOString(),
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=900",
    },
    body: JSON.stringify(body),
  };
}

async function getBlobStore() {
  try {
    const { getStore } = require("@netlify/blobs");
    const manualConfig =
      process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN
        ? {
            siteID: process.env.NETLIFY_BLOBS_SITE_ID,
            token: process.env.NETLIFY_BLOBS_TOKEN,
          }
        : undefined;

    if (!manualConfig) {
      return getStore(CACHE_STORE);
    }

    try {
      return getStore(CACHE_STORE, manualConfig);
    } catch (error) {
      return getStore({ name: CACHE_STORE, ...manualConfig });
    }
  } catch (error) {
    return null;
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 EurojackpotCircle/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`${url} responded with ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/gi, "EUR")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEuroJackpotNet(html, source) {
  const text = cleanText(html).replace(/&times;/g, "x");
  const markerIndex = text.search(/Latest Result/i);
  const segment = markerIndex >= 0 ? text.slice(markerIndex, markerIndex + 1800) : text;
  const dateMatch = segment.match(/Latest Result\s+(Friday|Tuesday)\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(20\d{2})/i);
  const jackpotIndex = segment.search(/Jackpot\s*(?:EUR|€)/i);
  const beforeJackpot = jackpotIndex >= 0 ? segment.slice(0, jackpotIndex) : segment;
  const jackpotMatch = segment.match(/Jackpot\s*(?:EUR|€)\s*([\d.,]+)/i);
  const numberMatches = [...beforeJackpot.matchAll(/\b([1-9]|[1-4]\d|50)\b/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isInteger(number))
    .slice(-7);

  if (!dateMatch || numberMatches.length < 7) {
    throw new Error(`${source.name} parse failed`);
  }

  return normalizeResult({
    drawDate: `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]} ${dateMatch[4]}`,
    numbers: numberMatches.slice(0, 5),
    euroNumbers: numberMatches.slice(5, 7),
    jackpot: jackpotMatch ? `${jackpotMatch[1]} EUR` : "unbekannt",
    source: source.url,
  });
}

function parseGenericHtml(html, source) {
  const text = cleanText(html);
  const markerIndex = text.search(/Eurojackpot|Gewinnzahlen|Result|Jackpot/i);
  const segment = markerIndex >= 0 ? text.slice(markerIndex, markerIndex + 10000) : text;
  const dateMatch =
    segment.match(/(Freitag|Dienstag|Friday|Tuesday)[,\s]+(\d{1,2}[.\s]\s*\w+[.\s]*\s*20\d{2}|\d{1,2}\s+\w+\s+20\d{2})/i) ||
    segment.match(/(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/);
  const jackpotMatch =
    segment.match(/Jackpot[^0-9]{0,60}([\d.,]+)\s*(Mio\.?|Millionen|EUR|€)/i) ||
    segment.match(/([\d.,]+)\s*(Mio\.?|Millionen|EUR|€)[^A-Za-z]{0,60}Jackpot/i);
  const allNumbers = [...segment.matchAll(/\b([1-9]|[1-4]\d|50)\b/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isInteger(number));
  const candidate = findNumberSet(allNumbers);

  if (!candidate) {
    throw new Error(`${source.name} parse failed`);
  }

  return normalizeResult({
    drawDate: dateMatch ? dateMatch[0] : "Aktuelle Ziehung",
    numbers: candidate.numbers,
    euroNumbers: candidate.euroNumbers,
    jackpot: jackpotMatch ? `${jackpotMatch[1]} ${jackpotMatch[2].replace("€", "EUR")}` : "unbekannt",
    source: source.url,
  });
}

function findNumberSet(numbers) {
  for (let index = 0; index <= numbers.length - 7; index += 1) {
    const main = numbers.slice(index, index + 5);
    const euro = numbers.slice(index + 5, index + 7);
    const validMain = main.every((number) => number >= 1 && number <= 50) && new Set(main).size === 5;
    const validEuro = euro.every((number) => number >= 1 && number <= 12) && new Set(euro).size === 2;

    if (validMain && validEuro) {
      return { numbers: main, euroNumbers: euro };
    }
  }

  return null;
}

function normalizeResult(result) {
  const numbers = [...result.numbers].map(Number).sort((a, b) => a - b);
  const euroNumbers = [...result.euroNumbers].map(Number).sort((a, b) => a - b);

  if (
    numbers.length !== 5 ||
    euroNumbers.length !== 2 ||
    numbers.some((number) => number < 1 || number > 50) ||
    euroNumbers.some((number) => number < 1 || number > 12)
  ) {
    throw new Error("Invalid Eurojackpot result shape");
  }

  return {
    drawDate: result.drawDate,
    numbers,
    euroNumbers,
    jackpot: result.jackpot,
    source: result.source,
    updatedAt: new Date().toISOString(),
  };
}

async function loadCachedResult() {
  const store = await getBlobStore();

  if (!store) {
    return null;
  }

  try {
    return await store.get(CACHE_KEY, { type: "json" });
  } catch (error) {
    return null;
  }
}

async function saveCachedResult(result) {
  const store = await getBlobStore();

  if (!store) {
    return;
  }

  try {
    await store.setJSON(CACHE_KEY, result);
  } catch (error) {
    // Cache writes should never break result delivery.
  }
}

exports.handler = async () => {
  const errors = [];

  for (const source of sources) {
    try {
      const html = await fetchText(source.url);
      const result = source.parser(html, source);
      await saveCachedResult(result);
      return json(200, result);
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
    }
  }

  const cached = await loadCachedResult();

  if (cached) {
    return json(200, {
      ...cached,
      source: `${cached.source} (cached)`,
      warning: errors.join(" | "),
    });
  }

  return json(200, {
    ...fallbackResult,
    warning: errors.join(" | "),
  });
};
