import { AstrologyService } from './src/utils/AstrologyService';

export async function getWeatherData(city: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    const curr = data.current_condition[0];
    return `Current weather in ${city}: ${curr.temp_C}°C (${curr.temp_F}°F), ${curr.weatherDesc[0].value}. Humidity: ${curr.humidity}%. Wind: ${curr.windspeedKmph} km/h.`;
  } catch (e) {
    return `Weather data for ${city} is currently unavailable.`;
  }
}

export async function getAstrologyData(sign: string) {
  try {
    return AstrologyService.getHoroscope(sign);
  } catch (e: any) {
    return `Horoscope for ${sign} is currently unavailable. Error: ${e.message}`;
  }
}

export async function getWebSearchData(query: string) {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const html = await res.text();
    const titles = html.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi);
    const snippets = html.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi);

    let results = [`Web search results for "${query}":`];

    if (titles && snippets) {
      const count = Math.min(titles.length, snippets.length, 5);
      for (let i = 0; i < count; i++) {
        const title = titles[i].replace(/<[^>]*>/g, '').trim();
        const snippet = snippets[i].replace(/<[^>]*>/g, '').trim();
        results.push(`${i + 1}. ${title} — ${snippet}`);
      }
    }

    return results.join('\n');
  } catch (e) {
    return `Web search for "${query}" is currently unavailable.`;
  }
}
