const RESULTS_URL = "https://www.euro-jackpot.net/results";
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

function parseLatestResult(html) {
  const compact = html.replace(/\s+/g, " ");
  const latestMatch = compact.match(/Latest Result.*?(Friday|Tuesday) ([^<]+? 20\d{2}).*?Jackpot €([\d,]+)/i);
  const numberMatches = [...compact.matchAll(/<li>\s*(\d{1,2})\s*<\/li>/gi)].slice(0, 7);

  if (!latestMatch || numberMatches.length < 7) {
    throw new Error("Unable to parse Eurojackpot result page");
  }

  return {
    drawDate: `${latestMatch[1]} ${latestMatch[2]}`,
    numbers: numberMatches.slice(0, 5).map((match) => Number(match[1])),
    euroNumbers: numberMatches.slice(5, 7).map((match) => Number(match[1])),
    jackpot: `€${latestMatch[3]}`,
    source: RESULTS_URL,
    updatedAt: new Date().toISOString(),
  };
}

exports.handler = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(RESULTS_URL, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Eurojackpot source responded with ${response.status}`);
    }

    const result = parseLatestResult(await response.text());

    return json(200, result);
  } catch (error) {
    return json(200, {
      ...fallbackResult,
      warning: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
};
