/**
 * Weather Widget
 * Uses National Weather Service (NWS) API (.gov)
 * Moon imagery from NASA SVS (Scientific Visualization Studio)
 */

'use strict';

window.DEBUG_WEATHER = {
  forceNight: false,
  forceMoonFrame: null,
  forceAlerts: false
};

class WeatherWidget {
  constructor(elementId, options = {}) {
    this.element = document.getElementById(elementId);
    if (!this.element) {
      console.warn(`WeatherWidget: Element with id '${elementId}' not found.`);
      return;
    }
    
    this.options = options;
    this.lat = options.lat || 38.8951;
    this.lon = options.lon || -77.0364;
    this.userAgent = options.userAgent || '(github.com/weather-widget, open-source)';
    this.theme = options.theme || 'auto';
    this.refreshInterval = options.refreshInterval || 600000;
    
    this.loadWeather();
    setInterval(() => this.loadWeather(), this.refreshInterval);
  }

  async loadWeather() {
    try {
      this.element.style.cursor = 'pointer';
      this.element.onclick = () => {
        const locName = this.locationName ? encodeURIComponent(this.locationName) : '';
        window.open(`full-forecast-gov.html?lat=${this.lat}&lon=${this.lon}&name=${locName}`, '_blank', 'noopener,noreferrer');
      };

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const headers = { 'User-Agent': this.userAgent };

      // 1. Get forecast grid endpoint
      const pointResponse = await Promise.race([
        fetch(`https://api.weather.gov/points/${this.lat},${this.lon}`, { headers }),
        timeoutPromise
      ]);
      if (!pointResponse.ok) throw new Error('Failed to fetch weather point data');
      const pointData = await pointResponse.json();
      const observationStationsUrl = pointData.properties.observationStations;
      const forecastUrl = pointData.properties.forecast;

      // 2. Get nearest observation station
      const stationsResponse = await Promise.race([
        fetch(observationStationsUrl, { headers }),
        timeoutPromise
      ]);
      if (!stationsResponse.ok) throw new Error('Failed to fetch stations');
      const stationsData = await stationsResponse.json();
      const nearestStation = stationsData.features[0].id;

      // 3. Get latest observation
      const observationResponse = await Promise.race([
        fetch(`${nearestStation}/observations/latest`, { headers }),
        timeoutPromise
      ]);
      if (!observationResponse.ok) throw new Error('Failed to fetch observation');
      const observationData = await observationResponse.json();
      const props = observationData.properties;

      // Extract location name
      let locName = this.options.locationName;
      if (!locName) {
        try {
          locName = `${pointData.properties.relativeLocation.properties.city}, ${pointData.properties.relativeLocation.properties.state}`;
        } catch(e) {
          locName = 'Local Forecast';
        }
      }
      this.locationName = locName;

      // 4. Get forecast
      let forecastText = '';
      let forecastPeriods = [];
      let activePeriod = null;
      try {
        const forecastResponse = await Promise.race([
          fetch(forecastUrl, { headers }),
          timeoutPromise
        ]);
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          forecastPeriods = forecastData.properties.periods;
          
          const now = new Date();
          const hour = now.getHours();
          
          activePeriod = forecastPeriods[0];
          
          if (forecastPeriods.length > 1 && hour >= 15) {
            const firstPeriodName = activePeriod.name.toLowerCase();
            const isFirstPeriodNight = firstPeriodName.includes('night') || firstPeriodName.includes('tonight');
            if (!isFirstPeriodNight) {
              activePeriod = forecastPeriods[1];
            }
          }
          
          forecastText = `${activePeriod.name}: ${activePeriod.detailedForecast}`;
        }
      } catch (e) {
        forecastText = props.textDescription || 'Current conditions';
      }

      // 5. Check for alerts
      let alertPrefix = '';
      try {
        const alertsResponse = await Promise.race([
          fetch(`https://api.weather.gov/alerts/active?point=${this.lat},${this.lon}`, { headers }),
          timeoutPromise
        ]);
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          const severeAlerts = (alertsData.features || []).filter(alert => 
            alert.properties.severity === 'Severe' || alert.properties.severity === 'Extreme'
          );
          if (severeAlerts.length > 0) {
            alertPrefix = `Active Alerts: ${severeAlerts.map(a => a.properties.event).join(', ')}\n\n`;
          }
        }
      } catch (e) {}

      if (window.DEBUG_WEATHER && window.DEBUG_WEATHER.forceAlerts) {
        alertPrefix = `Active Alerts: Severe Thunderstorm Warning, Tornado Watch\n\n`;
      }

      // Process Temp
      const tempC = props.temperature.value;
      const tempF = tempC !== null ? Math.round((tempC * 9/5) + 32) : null;
      if (tempF === null || isNaN(tempF)) throw new Error('Temperature data unavailable');

      const textDescription = props.textDescription || '';
      const iconUrl = props.icon || '';
      
      const iconData = this.getWeatherIcon(textDescription, iconUrl, null);

      this.renderWidget(iconData, tempF, alertPrefix + forecastText, forecastPeriods, activePeriod);

    } catch (error) {
      console.error('Weather API Failure:', error);
      this.element.style.display = 'none';
      this.element.textContent = '';
      this.element.title = '';
    }
  }

  renderWidget(iconData, tempF, tooltipText, forecastPeriods, activePeriod) {
    this.element.textContent = '';
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'weather-icon';
    iconSpan.textContent = iconData.text + (iconData.text && iconData.isNight ? ' ' : '');
    
    if (iconData.isNight && iconData.moonUrl) {
      const moonImg = document.createElement('img');
      moonImg.src = iconData.moonUrl;
      moonImg.alt = 'Moon phase';
      moonImg.draggable = false;
      
      Object.assign(moonImg.style, {
        height: '1.4em',
        width: '1.4em',
        objectFit: 'cover',
        verticalAlign: 'middle',
        borderRadius: '50%',
        margin: '0 2px',
        filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3))',
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserDrag: 'none'
      });
      
      moonImg.addEventListener('contextmenu', e => e.preventDefault());
      moonImg.addEventListener('error', function() {
        const fallbackText = document.createTextNode(iconData.moonEmoji);
        this.parentNode.replaceChild(fallbackText, this);
      });
      
      iconSpan.appendChild(moonImg);
    }
    
    const tempSpan = document.createElement('span');
    tempSpan.className = 'weather-temp';
    tempSpan.textContent = `${tempF}°F`;
    
    this.element.appendChild(iconSpan);
    this.element.appendChild(tempSpan);
    
    const forecastContainer = document.createElement('div');
    forecastContainer.className = 'hidden-forecast';
    forecastContainer.style.display = 'none';
    
    // prevent clicking the popup from triggering the main widget link
    forecastContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    let isNightUI = this.isNighttime();
    if (this.theme === 'light') isNightUI = false;
    else if (this.theme === 'dark') isNightUI = true;

    if (isNightUI) {
      forecastContainer.style.backgroundColor = '#1a1a24';
      forecastContainer.style.color = '#e0e0e0';
      forecastContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';
    }

    const locationHeader = document.createElement('div');
    locationHeader.className = 'forecast-location';
    locationHeader.textContent = this.locationName || 'Forecast';
    if (isNightUI) locationHeader.style.borderBottom = '1px solid #333';
    forecastContainer.appendChild(locationHeader);

    const daysContainer = document.createElement('div');
    daysContainer.className = 'forecast-days';
    
    if (forecastPeriods && forecastPeriods.length > 0 && activePeriod) {
      let startIndex = forecastPeriods.indexOf(activePeriod);
      if (startIndex === -1) startIndex = 0;
      const displayPeriods = forecastPeriods.slice(startIndex, startIndex + 4);
      
      displayPeriods.forEach((p, index) => {
        const pDate = p.startTime ? new Date(p.startTime) : new Date();
        const fIconData = this.getWeatherIcon(p.shortForecast, p.icon || '', !p.isDaytime, pDate);
        
        const block = document.createElement('div');
        block.className = 'forecast-block';
        if (index < displayPeriods.length - 1) {
          block.style.borderRight = isNightUI ? '1px solid #333' : '1px solid #eee';
        }
        
        const name = document.createElement('div');
        name.className = 'fc-name';
        if (isNightUI) name.style.color = '#aaa';
        let shortName = p.name.replace('This ', '');
        if (shortName === 'Today' || shortName === 'Rest of Today') shortName = 'Today';
        else shortName = shortName.replace('Monday', 'Mon').replace('Tuesday', 'Tue').replace('Wednesday', 'Wed').replace('Thursday', 'Thu').replace('Friday', 'Fri').replace('Saturday', 'Sat').replace('Sunday', 'Sun');
        name.textContent = shortName;
        
        const icon = document.createElement('div');
        icon.className = 'fc-icon';
        icon.textContent = fIconData.text + (fIconData.text && fIconData.isNight ? ' ' : '');
        
        if (fIconData.isNight && fIconData.moonUrl) {
          const moonImg = document.createElement('img');
          moonImg.src = fIconData.moonUrl;
          moonImg.alt = 'Moon phase';
          moonImg.draggable = false;
          Object.assign(moonImg.style, {
            height: '1.1em', width: '1.1em', objectFit: 'cover',
            verticalAlign: 'middle', borderRadius: '50%', margin: '0 2px',
            filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3))',
            pointerEvents: 'none', userSelect: 'none', WebkitUserDrag: 'none'
          });
          moonImg.addEventListener('contextmenu', e => e.preventDefault());
          moonImg.addEventListener('error', function() {
            const fallbackText = document.createTextNode(fIconData.moonEmoji || '🌙');
            this.parentNode.replaceChild(fallbackText, this);
          });
          icon.appendChild(moonImg);
        } else if (!fIconData.text) {
          icon.textContent = p.isDaytime ? '☀️' : '🌙';
        }
        
        const temp = document.createElement('div');
        temp.className = 'fc-temp';
        temp.textContent = `${p.temperature}°`;
        
        block.appendChild(name);
        block.appendChild(icon);
        block.appendChild(temp);
        daysContainer.appendChild(block);
      });
    }
    forecastContainer.appendChild(daysContainer);

    const detailedForecastText = activePeriod ? (activePeriod.detailedForecast || tooltipText) : tooltipText;
    if (detailedForecastText) {
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = "Today's Forecast";
      Object.assign(toggleBtn.style, {
        marginTop: '10px', padding: '4px 8px', fontSize: '0.85em', cursor: 'pointer',
        background: isNightUI ? '#2d2d3f' : '#f0f0f0',
        border: isNightUI ? '1px solid #444' : '1px solid #ccc',
        borderRadius: '4px', width: '100%',
        color: isNightUI ? '#eee' : '#333', fontWeight: 'bold'
      });

      const detailedDiv = document.createElement('div');
      detailedDiv.textContent = detailedForecastText;
      Object.assign(detailedDiv.style, {
        display: 'none', marginTop: '8px', fontSize: '0.85em', lineHeight: '1.4',
        textAlign: 'left', maxWidth: '260px', width: '100%', whiteSpace: 'normal', color: isNightUI ? '#bbb' : '#444'
      });

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (detailedDiv.style.display === 'none') {
          detailedDiv.style.display = 'block';
          toggleBtn.textContent = 'Hide Forecast';
        } else {
          detailedDiv.style.display = 'none';
          toggleBtn.textContent = "Today's Forecast";
        }
      });

      forecastContainer.appendChild(toggleBtn);
      forecastContainer.appendChild(detailedDiv);
    }

    this.element.appendChild(forecastContainer);
    // Removed native tooltip to prevent overlap
    
    let hideTimeout;
    this.element.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
      forecastContainer.style.display = 'block';
      
      const rect = this.element.getBoundingClientRect();
      const fcRect = forecastContainer.getBoundingClientRect();
      
      forecastContainer.style.top = '';
      forecastContainer.style.bottom = '';
      forecastContainer.style.left = '';
      forecastContainer.style.right = '';
      forecastContainer.style.marginTop = '';
      forecastContainer.style.marginBottom = '';
      
      if (rect.bottom + fcRect.height > window.innerHeight) {
        forecastContainer.style.bottom = '100%';
        forecastContainer.style.marginBottom = '10px';
      } else {
        forecastContainer.style.top = '100%';
        forecastContainer.style.marginTop = '10px';
      }
      
      if (rect.left + fcRect.width > window.innerWidth) {
        forecastContainer.style.right = '0';
      } else {
        forecastContainer.style.left = '0';
      }
    });
    
    this.element.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        forecastContainer.style.display = 'none';
      }, 150);
    });
  }

  isNighttime() {
    if (window.DEBUG_WEATHER && window.DEBUG_WEATHER.forceNight) return true;
    const now = new Date();
    
    // Mathematical calculation for sunset based on latitude and longitude
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const latRad = this.lat * Math.PI / 180;
    const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    const declinationRad = declination * Math.PI / 180;
    
    const zenith = 90.833 * Math.PI / 180;
    let cosH = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declinationRad)) / (Math.cos(latRad) * Math.cos(declinationRad));
    
    if (cosH > 1) return true; // Sun never rises
    if (cosH < -1) return false; // Sun never sets
    
    const hourAngle = Math.acos(cosH) * 180 / Math.PI;
    const sunHours = hourAngle / 15;
    
    const solarNoonUTC = 12 - (this.lon / 15);
    const sunriseUTC = solarNoonUTC - sunHours;
    const sunsetUTC = solarNoonUTC + sunHours;
    
    const currentUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
    
    let sunrise = (sunriseUTC + 24) % 24;
    let sunset = (sunsetUTC + 24) % 24;
    
    if (sunrise < sunset) {
      return currentUTC < sunrise || currentUTC > sunset;
    } else {
      return currentUTC > sunset && currentUTC < sunrise;
    }
  }

  getNASAMoonImageURL(targetDate = new Date()) {
    if (window.DEBUG_WEATHER && window.DEBUG_WEATHER.forceMoonFrame !== null) {
      return `https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005187/frames/730x730_1x1_30p/moon.${String(window.DEBUG_WEATHER.forceMoonFrame).padStart(4, '0')}.jpg`;
    }
    const year = targetDate.getUTCFullYear();
    const svsMap = { 2024: '5187', 2025: '5415', 2026: '5587' };
    let svsId = svsMap[year];
    
    if (svsId) {
      const startOfYear = Date.UTC(year, 0, 1, 0, 0, 0);
      const msSinceStart = targetDate.getTime() - startOfYear;
      const hoursSinceStart = Math.floor(msSinceStart / (1000 * 60 * 60));
      let frame = hoursSinceStart + 1;
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      const maxFrames = isLeap ? 8784 : 8760;
      if (frame > maxFrames) frame = maxFrames;
      const folderPrefix = svsId.substring(0, 2);
      return `https://svs.gsfc.nasa.gov/vis/a000000/a00${folderPrefix}00/a00${svsId}/frames/730x730_1x1_30p/moon.${String(frame).padStart(4, '0')}.jpg`;
    } else {
      const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
      const daysSinceKnownNew = (targetDate.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
      const synodicMonth = 29.53058867;
      const phase = ((daysSinceKnownNew % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth;
      const newMoonFrame2024 = 252;
      let frame = Math.round(newMoonFrame2024 + (phase * synodicMonth * 24));
      if (frame >= 8784) frame = frame % 8784;
      if (frame === 0) frame = 8784;
      return `https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005187/frames/730x730_1x1_30p/moon.${String(frame).padStart(4, '0')}.jpg`;
    }
  }

  getMoonPhaseEmoji(targetDate = new Date()) {
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const daysSinceKnownNew = (targetDate.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
    const synodicMonth = 29.53058867;
    const phase = ((daysSinceKnownNew % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth;
    const moonPhases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    return moonPhases[Math.floor(phase * 8) % 8];
  }

  extractWeatherCode(iconUrl) {
    if (!iconUrl) return null;
    const match = iconUrl.match(/\/(day|night)\/([^?\/]+)/);
    return match ? { timeOfDay: match[1], code: match[2] } : null;
  }

  getWeatherIcon(description, iconUrl, overrideNight = null, targetDate = new Date()) {
    const desc = description.toLowerCase();
    let isNight = overrideNight !== null ? overrideNight : this.isNighttime();
    if (window.DEBUG_WEATHER && window.DEBUG_WEATHER.forceNight) isNight = true;
    
    const weatherCode = this.extractWeatherCode(iconUrl);
    let weatherIcon = '';
    
    if (isNight) {
      if (weatherCode) {
        const code = weatherCode.code;
        if (code.includes('tsra') || code.includes('thunder')) weatherIcon = '⛈️';
        else if (code.includes('fzra') || code.includes('sleet') || code.includes('snow')) weatherIcon = '🌨️';
        else if (code.includes('rain')) weatherIcon = '🌧️';
        else if (code.includes('fog')) weatherIcon = '🌫️';
        else if (code.includes('ovc') || code.includes('bkn') || code.includes('sct')) weatherIcon = '☁️';
        else if (code.includes('few') || code.includes('skc') || code === 'clear') weatherIcon = '';
        else if (code.includes('wind')) weatherIcon = '💨';
      }
      
      if (!weatherIcon) {
        if (desc.includes('thunderstorm') || desc.includes('t-storm') || (desc.includes('rain') && desc.includes('thunder')) || desc.includes('hail')) weatherIcon = '⛈️';
        else if (desc.includes('snow') || desc.includes('blizzard') || desc.includes('sleet') || desc.includes('freezing') || desc.includes('ice')) weatherIcon = '🌨️';
        else if (desc.includes('rain') || desc.includes('showers') || desc.includes('drizzle') || desc.includes('sprinkle')) weatherIcon = '🌧️';
        else if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze') || desc.includes('smoke') || desc.includes('dust') || desc.includes('sand')) weatherIcon = '🌫️';
        else if (desc.includes('overcast') || desc.includes('cloudy')) weatherIcon = '☁️';
        else if (desc.includes('wind') || desc.includes('breezy') || desc.includes('gust')) weatherIcon = '💨';
        else if (desc.includes('clear') || desc.includes('fair') || desc === 'na' || desc === '') weatherIcon = '';
      }
      
      const nasaUrl = this.getNASAMoonImageURL(targetDate);
      const emojiMoon = this.getMoonPhaseEmoji(targetDate);
      
      return { text: weatherIcon, isNight: true, moonUrl: nasaUrl, moonEmoji: emojiMoon };
      
    } else {
      if (weatherCode) {
        const code = weatherCode.code;
        if (code.includes('tsra') || code.includes('thunder')) weatherIcon = '⛈️';
        else if (code.includes('fzra') || code.includes('sleet') || code.includes('snow')) weatherIcon = '🌨️';
        else if (code.includes('rain')) weatherIcon = '🌧️';
        else if (code.includes('fog')) weatherIcon = '🌫️';
        else if (code.includes('ovc')) weatherIcon = '☁️';
        else if (code.includes('bkn')) weatherIcon = '🌥️';
        else if (code.includes('sct')) weatherIcon = '⛅';
        else if (code.includes('few')) weatherIcon = '🌤️';
        else if (code.includes('skc') || code === 'clear') weatherIcon = '☀️';
        else if (code.includes('wind')) weatherIcon = '💨';
      }
      
      if (!weatherIcon) {
        if (desc.includes('thunderstorm') || desc.includes('t-storm') || (desc.includes('rain') && desc.includes('thunder')) || desc.includes('hail')) weatherIcon = '⛈️';
        else if (desc.includes('snow') || desc.includes('blizzard') || desc.includes('sleet') || desc.includes('freezing') || desc.includes('ice')) weatherIcon = '🌨️';
        else if (desc.includes('drizzle') || desc.includes('light rain') || desc.includes('sprinkle')) weatherIcon = '🌦️';
        else if (desc.includes('rain') || desc.includes('showers')) weatherIcon = '🌧️';
        else if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze') || desc.includes('smoke') || desc.includes('dust') || desc.includes('sand')) weatherIcon = '🌫️';
        else if (desc.includes('overcast')) weatherIcon = '☁️';
        else if (desc.includes('mostly cloudy')) weatherIcon = '🌥️';
        else if (desc.includes('partly cloudy') || desc.includes('partly sunny') || desc.includes('scattered clouds')) weatherIcon = '⛅';
        else if (desc.includes('mostly clear') || desc.includes('mostly sunny')) weatherIcon = '🌤️';
        else if (desc.includes('cloudy')) weatherIcon = '☁️';
        else if (desc.includes('wind') || desc.includes('breezy') || desc.includes('gust')) weatherIcon = '💨';
        else weatherIcon = '☀️';
      }
      
      return { text: weatherIcon, isNight: false };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeatherWidget;
} else {
  window.WeatherWidget = WeatherWidget;
}
