import google from 'googlethis';
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
    const options = { page: 0, safe: false, additional_params: { hl: 'en' } };
    const response = await google.search(query, options);
    
    let results = [];
    if (response.knowledge_panel && response.knowledge_panel.description) {
      results.push(`Knowledge: ${response.knowledge_panel.title} - ${response.knowledge_panel.description}`);
    }
    if (response.featured_snippet && response.featured_snippet.description) {
      results.push(`Snippet: ${response.featured_snippet.description}`);
    }
    response.results.slice(0, 4).forEach(r => {
      results.push(`- ${r.title}: ${r.description}`);
    });
    
    return `Web search results for "${query}":\n` + results.join('\n');
  } catch (e) {
    return `Web search for ${query} is currently unavailable.`;
  }
}
