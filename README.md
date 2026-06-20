# Talvi's Weather Widget (TWW) 🌦️🌑

A sleek, lightweight, and completely free weather widget built by **TalviFox**.

This widget provides real-time local weather and a beautiful 4-day forecast popup, featuring dynamically calculated moon phases with authentic NASA imagery. It supports dual backends: the [US National Weather Service (NWS)](https://www.weather.gov/) and the globally available [Open-Meteo](https://open-meteo.com/) API.

## Why I Made This
> Because modern weather websites are bloated with tracking scripts, auto-playing video ads, and clickbait articles, and frankly, ads suck! I just wanted to see the forecast.
> 
> Furthermore, in many corporate or locked-down office environments, you don't have permission to install external software or ad-blockers, and even running custom internal code can be difficult. I built this to solve that problem. 
> 
> By ensuring this widget runs **100% natively in the browser using Vanilla JavaScript and CSS**, it is incredibly lightweight and efficient. It doesn't pull in massive external frameworks, NPM packages, or third-party UI libraries. Because standard JavaScript is stable and highly backwards-compatible, you don't have to worry about framework breaking changes. This widget will keep humming along until the APIs die.

### Why Two API Versions?
> It might seem crazy to maintain two entirely separate versions of the same widget (and dashboard), but there's a good reason for it: Data accuracy vs. global availability. 
> 
> The US National Weather Service (NWS) API provides incredibly accurate, hyper-local, forecaster-adjusted data, but it only works in the US. Open-Meteo, on the other hand, aggregates data from global weather models (like ECMWF and GFS) and works everywhere in the world. Depending on your audience, you can pick the one that best fits your needs!
> 
> **A note for the "Govies" out there:** I know that in many secure government environments, using third-party services (like Open-Meteo) is strictly prohibited by firewall policies and compliance rules. And let's be honest... the default NWS website isn't exactly the prettiest thing to look at. The `weather-gov.js` widget provides a sleek, modern, and completely compliant interface that pulls directly from `api.weather.gov`!

### Origin Story: The NASA Moon
> Fun fact: this project actually started solely as an experiment to calculate and display the current NASA moon phase! I was initially chasing crazy DOM cropping techniques to try and manipulate the massive raw NASA image frames down to just the moon sphere. 
> 
> But in that chasing, I found out it was far easier to not chase the DOM. I settled on plain old HTML and CSS cropping by using a simple inline SVG with a circular `<clipPath>`. That process taught me an important lesson that became the philosophy for this entire widget: sometimes the easiest solution is the best one.


### For the NASA Nerds: How the Moon Logic Works
> If you're wondering how the widget perfectly simulates the current moon phase without pulling in heavy astronomical calculation libraries, here is the exact breakdown of the math:
> 
> 1. **The Data Source:** [NASA's Scientific Visualization Studio (SVS)](https://svs.gsfc.nasa.gov/) publishes an incredibly detailed "Dial-A-Moon" dataset every year (currently using SVS ID 5187 for 2024). NASA renders a high-resolution frame of the moon for every single hour of the entire year.
> 2. **The Calculation:** The widget's JavaScript dynamically calculates the current day of the year and multiplies it by 24 to find the exact frame ID corresponding to the current hour of the year. 
> 3. **The Fetch:** It zero-pads that frame ID into a 4-digit string (e.g., `0452`) and directly requests that specific `.jpg` frame from NASA's high-bandwidth asset servers.
> 4. **The Crop:** The raw NASA frames are large and include a bunch of extra astronomical data tables and black space around the moon. Rather than manipulating the DOM, the widget wraps the image in an inline `<svg>` and uses a perfectly positioned `<circle>` inside a `<clipPath>` to seamlessly crop out everything except the moon sphere itself.
> 
> The result is a lightweight, pixel-perfect, and scientifically accurate moon phase with zero dependencies!

## Features
- **Dynamic Day/Night UI:** Automatically calculates precise solar sunset/sunrise times based on your latitude and longitude. The UI dynamically switches to a gorgeous dark mode at night.
- **Accurate Moon Phases:** Uses real NASA imagery to display the exact current moon phase for your location.
- **Dual API Support:**
  - `weather-gov.js`: Uses the US `.gov` NWS API (US territories only).
  - `weather-open-meteo.js`: Uses the Open-Meteo API (Global support).
- **Clean Hover UI:** A gorgeous hover forecast box with an expandable detailed forecast text view.
- **Self-Hosted Dashboards:** Both widgets natively link to included, fully responsive standalone dashboard pages (`full-forecast.html` and `full-forecast-gov.html`) powered entirely by Vanilla JS and their respective APIs. No third-party website links are required.

## Usage

Include the Javascript file of your choice, create a container element, and initialize the widget.

```html
<!-- 1. Include the script -->
<script src="weather-open-meteo.js"></script>

<!-- 2. Create a container -->
<div id="my-weather">Loading...</div>

<!-- 3. Initialize -->
<script>
  new WeatherWidget('my-weather', {
      lat: 38.8951,
      lon: -77.0364,
      locationName: 'Washington DC', // Optional
      theme: 'auto' // Optional: 'auto', 'light', or 'dark' (locks the popup UI color)
  });
</script>
```

## Acknowledgments
- **[Open-Meteo](https://open-meteo.com/):** For their robust open-source weather API.
- **[National Weather Service (NWS)](https://www.weather.gov/):** For providing reliable US weather data.
- **[NASA](https://www.nasa.gov/):** For the stunning astronomical moon imagery.

## API Usage & Rate Limits
Please play nice! Both Open-Meteo and the National Weather Service are incredible free resources, but they have usage rules and rate limits. If you're going to fork or host this widget on a high-traffic site, please review and abide by their terms of service so we can keep these APIs free and open for everyone.

- [Open-Meteo Terms of Service](https://open-meteo.com/en/terms)
- [NWS Web API Terms of Service](https://www.weather.gov/documentation/services-web-api)

## Disclaimer
I am not affiliated, associated, authorized, endorsed by, or in any way officially connected with the National Weather Service (NWS), Open-Meteo, NASA, or any of their subsidiaries or affiliates. All data and imagery are pulled from their respective public APIs and services.

## License
Released under the [MIT License](LICENSE). You are free to fork, modify, and distribute this project as long as you provide credit to **TalviFox** (a link back to this GitHub repository is greatly appreciated!).
