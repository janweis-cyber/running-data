const SVG_NS = "http://www.w3.org/2000/svg";

// Cumulative distance at the start of each leg, plus the finish: [0, 5, 13, 18, 28, 33, 42.195]
const CUMULATIVE_DIST = COURSE.legs.reduce(
  (acc, leg) => {
    acc.push(acc[acc.length - 1] + leg.distance);
    return acc;
  },
  [0]
);

const PAGE_LOAD = Date.now();

function elapsedSeconds() {
  const realElapsed = (Date.now() - PAGE_LOAD) / 1000;
  return RACE_START_OFFSET_SEC + realElapsed * SIM_SPEED;
}

function formatClock(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPace(minPerKm) {
  if (!isFinite(minPerKm) || minPerKm <= 0) return "--:--";
  const totalSec = Math.round(minPerKm * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function legTimeSec(team, legIndex) {
  return COURSE.legs[legIndex].distance * team.runners[legIndex].pace * 60;
}

function teamTotalTimeSec(team) {
  return COURSE.legs.reduce((sum, leg, i) => sum + legTimeSec(team, i), 0);
}

// Computes a team's position in the race at a given simulated elapsed time.
function computeTeamState(team, elapsed) {
  let timeUsed = 0;
  for (let i = 0; i < COURSE.legs.length; i++) {
    const legTime = legTimeSec(team, i);
    if (elapsed >= timeUsed + legTime) {
      timeUsed += legTime;
      continue;
    }
    const legElapsed = elapsed - timeUsed;
    const legDistanceCovered = legElapsed / (team.runners[i].pace * 60);
    return {
      status: "running",
      legIndex: i,
      distanceCovered: CUMULATIVE_DIST[i] + legDistanceCovered,
      legElapsed,
      legTime,
      finishTime: null,
    };
  }
  return {
    status: "finished",
    legIndex: COURSE.legs.length - 1,
    distanceCovered: COURSE.totalDistance,
    legElapsed: null,
    legTime: null,
    finishTime: timeUsed,
  };
}

function buildEvents() {
  const events = [];
  TEAMS.forEach((team) => {
    events.push({
      time: 0,
      teamId: team.id,
      text: `${team.short} start Leg 1 with ${team.runners[0].name}`,
    });
    let t = 0;
    for (let i = 0; i < COURSE.legs.length; i++) {
      t += legTimeSec(team, i);
      if (i < COURSE.legs.length - 1) {
        events.push({
          time: t,
          teamId: team.id,
          text: `${team.short} handoff: Leg ${i + 1} → Leg ${i + 2} (${team.runners[i + 1].name})`,
        });
      } else {
        events.push({
          time: t,
          teamId: team.id,
          text: `${team.short} cross the finish line! 🏁`,
        });
      }
    }
  });
  events.sort((a, b) => a.time - b.time);
  return events;
}

const EVENTS = buildEvents();

// ---- SVG course map -------------------------------------------------------

const routePath = document.getElementById("routePath");
const courseMap = document.getElementById("courseMap");
const totalLength = routePath.getTotalLength();

function pointAtFraction(fraction) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return routePath.getPointAtLength(clamped * totalLength);
}

function initCheckpoints() {
  CUMULATIVE_DIST.forEach((dist, i) => {
    const frac = dist / COURSE.totalDistance;
    const pt = pointAtFraction(frac);

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "checkpoint");
    circle.setAttribute("cx", pt.x);
    circle.setAttribute("cy", pt.y);
    circle.setAttribute("r", 6);
    courseMap.appendChild(circle);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "checkpoint-label");
    label.setAttribute("x", pt.x);
    label.setAttribute("y", pt.y - 14);
    label.setAttribute("text-anchor", "middle");
    label.textContent = i === 0 ? "S" : i === CUMULATIVE_DIST.length - 1 ? "F" : `L${i}`;
    courseMap.appendChild(label);
  });
}

const teamMarkers = {};

function initTeamMarkers() {
  TEAMS.forEach((team) => {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "team-marker");

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", 10);
    circle.setAttribute("fill", team.color);
    g.appendChild(circle);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dy", "0.32em");
    label.textContent = team.short.slice(0, 1);
    g.appendChild(label);

    courseMap.appendChild(g);
    teamMarkers[team.id] = { g, circle, label };
  });
}

function updateTeamMarkers(states) {
  TEAMS.forEach((team) => {
    const state = states[team.id];
    const pt = pointAtFraction(state.distanceCovered / COURSE.totalDistance);
    const marker = teamMarkers[team.id];
    marker.g.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
    marker.g.classList.toggle("finished", state.status === "finished");
  });
}

function initLegend() {
  const legend = document.getElementById("mapLegend");
  legend.innerHTML = "";
  TEAMS.forEach((team) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${team.color}"></span>${team.name}`;
    legend.appendChild(item);
  });
}

// ---- Leaderboard ------------------------------------------------------------

const leaderboardBody = document.getElementById("leaderboardBody");

function compareStates(a, b) {
  const sa = a.state;
  const sb = b.state;
  if (sa.status === "finished" && sb.status === "finished") {
    return sa.finishTime - sb.finishTime;
  }
  if (sa.status === "finished") return -1;
  if (sb.status === "finished") return 1;
  return sb.distanceCovered - sa.distanceCovered;
}

function renderLeaderboard(states, elapsed) {
  const rows = TEAMS.map((team) => ({ team, state: states[team.id] })).sort(compareStates);

  leaderboardBody.innerHTML = "";
  rows.forEach((row, idx) => {
    const { team, state } = row;
    const tr = document.createElement("tr");
    if (team.id === "jrc") tr.classList.add("highlight");

    const current =
      state.status === "finished"
        ? "Finished"
        : `Leg ${state.legIndex + 1} — ${team.runners[state.legIndex].name}`;

    const avgPace = state.distanceCovered > 0 ? (elapsed / 60) / state.distanceCovered : NaN;
    const timeDisplay =
      state.status === "finished" ? formatClock(state.finishTime) : formatClock(elapsed);

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="team-cell"><span class="legend-dot" style="background:${team.color}"></span>${team.name}</span></td>
      <td>${current}</td>
      <td class="mono">${state.distanceCovered.toFixed(2)} km</td>
      <td class="mono">${formatPace(avgPace)} /km</td>
      <td class="mono">${timeDisplay}</td>
    `;
    leaderboardBody.appendChild(tr);
  });

  return rows;
}

// ---- Leg splits ---------------------------------------------------------------

const teamTabs = document.getElementById("teamTabs");
const splitsBody = document.getElementById("splitsBody");
let selectedTeamId = "jrc";

function initTeamTabs() {
  teamTabs.innerHTML = "";
  TEAMS.forEach((team) => {
    const btn = document.createElement("button");
    btn.className = "team-tab";
    btn.dataset.teamId = team.id;
    btn.style.setProperty("--tab-color", team.color);
    btn.textContent = team.short;
    if (team.id === selectedTeamId) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedTeamId = team.id;
      teamTabs.querySelectorAll(".team-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderSplits(computeTeamState(getTeam(selectedTeamId), elapsedSeconds()));
    });
    teamTabs.appendChild(btn);
  });
}

function getTeam(id) {
  return TEAMS.find((t) => t.id === id);
}

function renderSplits(state) {
  const team = getTeam(selectedTeamId);
  splitsBody.innerHTML = "";

  COURSE.legs.forEach((leg, i) => {
    const runner = team.runners[i];
    const split = legTimeSec(team, i);
    let status;
    let splitDisplay = formatClock(split);

    if (state.status === "finished" || i < state.legIndex) {
      status = "Done";
    } else if (i === state.legIndex && state.status === "running") {
      const pct = Math.min(100, Math.round((state.legElapsed / state.legTime) * 100));
      status = `Running · ${pct}%`;
      splitDisplay = `${formatClock(state.legElapsed)} / ${formatClock(split)}`;
    } else {
      status = "Upcoming";
    }

    const tr = document.createElement("tr");
    if (status.startsWith("Running")) tr.classList.add("active-leg");
    tr.innerHTML = `
      <td>${leg.number}. ${leg.name}</td>
      <td>${runner.name}</td>
      <td class="mono">${leg.distance.toFixed(2)} km</td>
      <td class="mono">${splitDisplay}</td>
      <td class="mono">${formatPace(runner.pace)} /km</td>
      <td>${status}</td>
    `;
    splitsBody.appendChild(tr);
  });
}

// ---- Live feed ------------------------------------------------------------------

const feedList = document.getElementById("feedList");

function renderFeed(elapsed) {
  const happened = EVENTS.filter((e) => e.time <= elapsed);
  const latest = happened.slice(-15).reverse();

  feedList.innerHTML = "";
  latest.forEach((event) => {
    const team = getTeam(event.teamId);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="legend-dot" style="background:${team.color}"></span>
      <span class="feed-text">${event.text}</span>
      <span class="feed-time mono">${formatClock(event.time)}</span>
    `;
    feedList.appendChild(li);
  });
}

// ---- Hero stats -------------------------------------------------------------------

const raceClockEl = document.getElementById("raceClock");
const leaderNameEl = document.getElementById("leaderName");
const teamsFinishedEl = document.getElementById("teamsFinished");
const liveBadge = document.getElementById("liveBadge");

function renderHero(elapsed, rows) {
  raceClockEl.textContent = formatClock(elapsed);
  leaderNameEl.textContent = rows[0].team.name;

  const finishedCount = rows.filter((r) => r.state.status === "finished").length;
  teamsFinishedEl.textContent = `${finishedCount} / ${TEAMS.length}`;

  if (finishedCount === TEAMS.length) {
    liveBadge.classList.add("final");
    liveBadge.innerHTML = "FINAL";
  }
}

// ---- Main tick ------------------------------------------------------------------------

function tick() {
  const elapsed = elapsedSeconds();
  const states = {};
  TEAMS.forEach((team) => {
    states[team.id] = computeTeamState(team, elapsed);
  });

  const rows = renderLeaderboard(states, elapsed);
  updateTeamMarkers(states);
  renderHero(elapsed, rows);
  renderSplits(states[selectedTeamId]);
  renderFeed(elapsed);
}

initCheckpoints();
initTeamMarkers();
initLegend();
initTeamTabs();
tick();
setInterval(tick, 1000);
