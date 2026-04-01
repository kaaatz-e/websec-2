const API_BASE = "http://127.0.0.1:7000";

let map;
let markersLayer;
let currentChart = null;
let weatherCache = {};
const CACHE_TTL = 10 * 60 * 1000;

function initMap() {
    map = L.map("map").setView([55.75, 37.61], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OSM &copy; CartoDB',
        subdomains: "abcd",
        maxZoom: 19,
        minZoom: 3
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    markersLayer = L.layerGroup().addTo(map);
}

async function loadSettlements() {
    try {
        const res = await fetch(`${API_BASE}/settlements`);
        const data = await res.json();
        data.forEach(city => {
            if (!city.lat || !city.lon) return;
            const marker = L.circleMarker([city.lat, city.lon], {
                radius: 5,
                color: "#38bdf8",
                fillColor: "#38bdf8",
                fillOpacity: 0.7,
                weight: 1,
                opacity: 0.8
            });
            marker.on("click", () => onCityClick(city));
            marker.addTo(markersLayer);
        });
    } catch (e) {
        console.error("Ошибка загрузки населённых пунктов:", e);
        document.getElementById("bottom-panel").innerHTML = "<p>Не удалось загрузить список городов</p>";
    }
}

async function onCityClick(city) {
    const panel = document.getElementById("bottom-panel");
    panel.innerHTML = `<p>Загрузка прогноза для <b>${city.locality}</b>...</p>`;
    try {
        const cacheKey = `${city.lat},${city.lon}`;
        let weatherData;
        const cached = weatherCache[cacheKey];
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            weatherData = cached.data;
        } else {
            const res = await fetch(`${API_BASE}/weather?lat=${city.lat}&lon=${city.lon}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            weatherData = await res.json();
            weatherCache[cacheKey] = { data: weatherData, timestamp: Date.now() };
        }
        renderWeather(city, weatherData);
    } catch (e) {
        console.error(e);
        panel.innerHTML = `<p>Ошибка загрузки погоды для ${city.locality}</p>`;
    }
}

function renderWeather(city, data) {
    const panel = document.getElementById("bottom-panel");
    const timeStamps = data.hourly.time;
    if (!timeStamps || timeStamps.length === 0) {
        panel.innerHTML = `<p>Нет данных о погоде для ${city.locality}</p>`;
        return;
    }

    const daysMap = new Map();
    timeStamps.forEach((ts, idx) => {
        const date = ts.split('T')[0];
        if (!daysMap.has(date)) {
            daysMap.set(date, { times: [], temps: [], winds: [], rains: [] });
        }
        const dayData = daysMap.get(date);
        dayData.times.push(ts.split('T')[1].slice(0, 5));
        dayData.temps.push(data.hourly.temperature_2m[idx]);
        dayData.winds.push(data.hourly.wind_speed_10m[idx]);
        dayData.rains.push(data.hourly.precipitation[idx]);
    });

    const days = Array.from(daysMap.entries()).map(([date, values]) => {
        const avgTemp = values.temps.reduce((a, b) => a + b, 0) / values.temps.length;
        const totalRain = values.rains.reduce((a, b) => a + b, 0);
        return { date, values, avgTemp, totalRain };
    });

    function formatDayOfWeek(dateStr) {
        const [year, month, day] = dateStr.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    }

    function getWeatherIcon(day) {
        const { totalRain, avgTemp } = day;
        let iconPath = '';
        if (totalRain > 0.5) {
            iconPath = avgTemp <= 0 ? 'image/snowy.png' : 'image/rain.png';
        } else {
            if (avgTemp > 20) iconPath = 'image/sun.png';
            else if (avgTemp > 10) iconPath = 'image/sunny.png';
            else iconPath = 'image/cloudy.png';
        }
        return `<img src="${iconPath}" alt="погода" class="weather-icon">`;
    }

    function formatTemp(temp) {
        const sign = temp > 0 ? '+' : '';
        return `${sign}${Math.round(temp)}°`;
    }

    panel.innerHTML = `
        <h3>${city.locality}</h3>
        <div class="date-selector">
            ${days.map(day => `
                <div class="day-card" data-date="${day.date}">
                    <div class="day-week">${formatDayOfWeek(day.date)}</div>
                    <div class="day-date">${day.date.split('-')[2]}</div>
                    <div class="day-icon">${getWeatherIcon(day)}</div>
                    <div class="day-temp">${formatTemp(day.avgTemp)}</div>
                </div>
            `).join('')}
        </div>
        <canvas id="weatherChart"></canvas>
    `;

    function drawChart(selectedDate) {
        const dayData = days.find(d => d.date === selectedDate);
        if (!dayData) return;
        const ctx = document.getElementById("weatherChart").getContext("2d");
        if (currentChart) currentChart.destroy();

        currentChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: dayData.values.times,
                datasets: [
                    {
                        label: "Температура (°C)",
                        data: dayData.values.temps,
                        borderColor: "#f91616",
                        backgroundColor: "rgba(249,115,22,0.1)",
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    },
                    {
                        label: "Ветер (м/с)",
                        data: dayData.values.winds,
                        borderColor: "#3be0f6",
                        backgroundColor: "rgba(59,130,246,0.1)",
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    },
                    {
                        label: "Осадки (мм)",
                        data: dayData.values.rains,
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(16,185,129,0.1)",
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { mode: "index", intersect: false },
                scales: {
                    x: { title: { display: true, text: "Время", color: "#94a3b8" } },
                    y: { title: { display: true, text: "Значение", color: "#94a3b8" } }
                },
                plugins: {
                    tooltip: { mode: "index", intersect: false },
                    legend: { labels: { color: "#e2e8f0" } }
                }
            }
        });
    }

    const today = new Date().toISOString().split('T')[0];
    let defaultDate = days.some(d => d.date === today) ? today : days[0].date;
    drawChart(defaultDate);

    const cards = document.querySelectorAll(".day-card");
    cards.forEach(card => {
        card.addEventListener("click", () => {
            cards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            drawChart(card.dataset.date);
        });
    });

    const activeCard = document.querySelector(`.day-card[data-date="${defaultDate}"]`);
    if (activeCard) activeCard.classList.add("active");
}

async function searchCity(query) {
    if (!query.trim()) return;
    const panel = document.getElementById("search-results");
    panel.innerHTML = `<p>Ищем "${query}"...</p>`;
    try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const results = await res.json();
        if (!results.length) {
            panel.innerHTML = `<p>Ничего не найдено для "${query}"</p>`;
            return;
        }
        panel.innerHTML = results.map(city => `
            <div class="search-item" data-lat="${city.lat}" data-lon="${city.lon}">
                ${city.locality}
            </div>
        `).join("");
        document.querySelectorAll(".search-item").forEach(el => {
            el.addEventListener("click", () => {
                const lat = parseFloat(el.dataset.lat);
                const lon = parseFloat(el.dataset.lon);
                if (!isNaN(lat) && !isNaN(lon)) {
                    map.setView([lat, lon], 10);
                    onCityClick({ locality: el.innerText, lat, lon });
                }
            });
        });
    } catch (e) {
        console.error(e);
        panel.innerHTML = `<p>Ошибка поиска</p>`;
    }
}

function initEvents() {
    const input = document.getElementById("search-input");
    const btn = document.getElementById("search-btn");
    btn.addEventListener("click", () => searchCity(input.value));
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchCity(input.value);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initMap();
    loadSettlements();
    initEvents();
});