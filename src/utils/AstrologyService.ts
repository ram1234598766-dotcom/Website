import * as Astronomy from 'astronomy-engine';

export class AstrologyService {
  /**
   * Calculates the current planetary positions and ephemeris data.
   */
  static getPlanetaryPositions(date: Date = new Date()): any {
    const bodies = [
      'Sun', 'Moon', 'Mercury', 'Venus', 'Earth', 'Mars', 
      'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'
    ];
    
    const positions = bodies.map(body => {
      if (body === 'Earth') return null; // We calculate from Earth's perspective usually, but astronomy-engine uses Equatorial
      try {
        const eq = Astronomy.Equator(body as import('astronomy-engine').Body, date, { latitude: 0, longitude: 0, height: 0 }, true, true);
        return {
          body,
          ra: eq.ra, // Right Ascension
          dec: eq.dec, // Declination
          dist: eq.vec.Length() // Distance in AU
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    return {
      date: date.toISOString(),
      positions
    };
  }

  /**
   * Generates a dynamic horoscope based on actual ephemeris calculations.
   */
  static async getHoroscope(sign: string): Promise<string> {
    let apiHoroscope = "";
    try {
      const response = await fetch(`https://ohmanda.com/api/horoscope/${sign.toLowerCase()}/`);
      if (response.ok) {
        const result = await response.json();
        if (result.horoscope) {
          apiHoroscope = result.horoscope;
        }
      }
    } catch (err) {
      console.error("Failed to fetch horoscope from API", err);
    }

    const data = this.getPlanetaryPositions();
    const activePlanet = data.positions[Math.floor(Math.random() * data.positions.length)]?.body || 'Venus';
    
    let ephemeris = `Astrological Ephemeris for ${sign} on ${new Date().toLocaleDateString()}: \nThe current configuration of celestial bodies, notably ${activePlanet} in prominent ascension (RA: ${data.positions.find((p: any) => p.body === activePlanet)?.ra.toFixed(2)}), indicates a period of dynamic cosmic alignment.`;

    if (apiHoroscope) {
      return `${ephemeris}\n\nDaily Horoscope:\n${apiHoroscope}`;
    }

    return `${ephemeris} \nYou may feel the gravitational and energetic shifts influencing your sector of focus. Stay grounded and leverage this astronomical momentum.`;
  }
}
