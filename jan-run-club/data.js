// Static mock data for the Jan Run Club live Ekiden tracker.
// Pace values are minutes per kilometre for the runner on that leg.

const COURSE = {
  eventName: "Midsommar Ekiden",
  location: "Stockholm, Sweden",
  totalDistance: 42.195,
  legs: [
    { number: 1, name: "Gamla Stan Loop", distance: 5.0 },
    { number: 2, name: "Djurgården Stretch", distance: 8.0 },
    { number: 3, name: "Söder Hills", distance: 5.0 },
    { number: 4, name: "Lake Mälaren Run", distance: 10.0 },
    { number: 5, name: "Kungsholmen Bridge", distance: 5.0 },
    { number: 6, name: "Stadium Finish", distance: 9.195 },
  ],
};

// Pace deltas applied per leg (min/km), relative to a team's base pace.
const LEG_PACE_DELTA = [0, -0.05, 0.10, -0.10, 0.05, -0.15];

function buildRunners(base, names) {
  return names.map((name, i) => ({
    name,
    pace: Math.round((base + LEG_PACE_DELTA[i]) * 100) / 100,
  }));
}

const TEAMS = [
  {
    id: "jrc",
    name: "Jan Run Club",
    short: "JRC",
    color: "#ffd60a",
    runners: buildRunners(3.90, [
      "Erik Söderberg",
      "Maja Lindqvist",
      "Oskar Berg",
      "Linnea Holm",
      "Astrid Nilsson",
      "Jan Weiss",
    ]),
  },
  {
    id: "sst",
    name: "Södermalm Striders",
    short: "SST",
    color: "#ff5d8f",
    runners: buildRunners(3.80, [
      "Hugo Andersson",
      "Wilma Karlsson",
      "Liam Eriksson",
      "Alice Johansson",
      "Noah Persson",
      "Olivia Nilsson",
    ]),
  },
  {
    id: "ddc",
    name: "Djurgården Distance Crew",
    short: "DDC",
    color: "#2ec4b6",
    runners: buildRunners(4.00, [
      "Anton Gustafsson",
      "Saga Olsson",
      "Elias Larsson",
      "Alma Pettersson",
      "Lucas Jonsson",
      "Ebba Magnusson",
    ]),
  },
  {
    id: "nrf",
    name: "Norrland Flyers",
    short: "NRF",
    color: "#4cc9f0",
    runners: buildRunners(4.15, [
      "Viktor Bergström",
      "Stella Lindberg",
      "Leo Forsberg",
      "Freja Sandberg",
      "Axel Lundgren",
      "Ines Wallin",
    ]),
  },
  {
    id: "vsv",
    name: "Vasastan Velocity",
    short: "VSV",
    color: "#a78bfa",
    runners: buildRunners(4.35, [
      "Gustav Åberg",
      "Nova Sjögren",
      "Felix Dahlin",
      "Tilde Ekström",
      "Melker Holmberg",
      "Signe Falk",
    ]),
  },
  {
    id: "ktc",
    name: "Kungsholmen Track Club",
    short: "KTC",
    color: "#f4a261",
    runners: buildRunners(4.55, [
      "Adrian Blom",
      "Klara Hedlund",
      "Theo Lindholm",
      "Wilma Ahlgren",
      "Casper Rosén",
      "Selma Vikström",
    ]),
  },
];

// How far into the race the tracker appears when first loaded (seconds).
const RACE_START_OFFSET_SEC = 105 * 60;

// Simulated seconds per real second, so the multi-hour race plays out quickly.
const SIM_SPEED = 20;
