"use strict";

/* =========================================================================
   TIMES TABLES ADVENTURE - script.js
   Clean, modular vanilla JS. No frameworks, no backend.
   Sections:
     1. Constants & State (localStorage)
     2. Utility helpers
     3. Navigation
     4. Home screen (table grid + level bar)
     5. Learn Mode
     6. Question generator (shared by Practice/Timed/Daily/Master)
     7. Practice Mode
     8. Timed (Speed) Challenge
     9. Flash Cards
    10. Fill the Missing Number
    11. Daily Challenge
    12. Master Quiz (Level 4)
    13. Printable Worksheet
    14. Achievements
    15. Leaderboard
    16. Parent Dashboard
    17. Settings
    18. Rewards (overlay, stars, confetti, sound, speech)
    19. Init
   ========================================================================= */

/* ============================ 1. CONSTANTS & STATE ============================ */

const TABLES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const STORAGE_KEY = "mtapp_state_v1";

const ACHIEVEMENT_LIST = [
  { id: "first_step", icon: "👣", name: "First Step", check: s => s.totalQuestions >= 1 },
  { id: "streak_5", icon: "🔥", name: "5 Streak", check: s => s.bestStreak >= 5 },
  { id: "streak_10", icon: "🚒", name: "10 Streak", check: s => s.bestStreak >= 10 },
  { id: "perfect_round", icon: "💯", name: "Perfect Round", check: s => s.hadPerfectRound },
  { id: "table_master", icon: "📚", name: "Table Master", check: s => s.tablesCompleted.length >= 1 },
  { id: "all_tables", icon: "🌟", name: "All Tables!", check: s => s.tablesCompleted.length >= TABLES.length },
  { id: "speedster", icon: "⚡", name: "Speedster", check: s => s.bestTimedStars >= 3 },
  { id: "centurion", icon: "🏛️", name: "Centurion", check: s => s.totalCorrect >= 100 },
  { id: "daily_5", icon: "📅", name: "Daily Devotee", check: s => s.dailyCompletedCount >= 5 },
];

const MOTIVATION_MESSAGES = ["Excellent!", "Amazing!", "Keep Going!", "Super Star!", "Fantastic!", "Wow, Brilliant!"];

function defaultState() {
  const tableStats = {};
  TABLES.forEach(t => { tableStats[t] = { attempts: 0, correct: 0 }; });
  return {
    settings: { sound: true, dark: false, fontSize: "medium", name: "" },
    level: 1,
    highestScore: 0,
    lastPlayedDate: null,
    dailyStreak: 0,
    lastStreakDate: null,
    tablesCompleted: [],
    sessions: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    bestStreak: 0,
    bestTimedStars: 0,
    hadPerfectRound: false,
    dailyCompletedCount: 0,
    tableStats: tableStats,
    leaderboard: [],
    achievements: [],
    dailyChallenge: { date: null, completed: false, score: 0 },
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge with defaults so new fields are always present
    return Object.assign(defaultState(), parsed, {
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
      tableStats: Object.assign(defaultState().tableStats, parsed.tableStats || {}),
    });
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ============================ 2. UTILITY HELPERS ============================ */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function $(id) { return document.getElementById(id); }

/* ============================ 3. NAVIGATION ============================ */

function navigateTo(screenName) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = $("screen-" + screenName);
  if (target) target.classList.add("active");
  $("mainNav").classList.remove("open");

  // Refresh dynamic content when entering a screen
  if (screenName === "home") renderHome();
  if (screenName === "achievements") renderAchievements();
  if (screenName === "leaderboard") renderLeaderboard();
  if (screenName === "dashboard") renderDashboard();
  if (screenName === "worksheet") initWorksheetScreen();
  if (screenName === "daily") startDailyChallenge();
  if (screenName === "flashcards") startFlashcards();
  if (screenName === "fillmissing") nextFillQuestion();
  if (screenName === "practice") startPractice();
  if (screenName === "master") startMasterQuiz();
  if (screenName === "learn") renderLearnTable();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupNavigation() {
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", () => navigateTo(el.getAttribute("data-nav")));
  });
  $("menuToggle").addEventListener("click", () => $("mainNav").classList.toggle("open"));
}

/* ============================ 4. HOME SCREEN ============================ */

function renderHome() {
  // Level progress pills
  const levels = ["Learn", "Practice", "Speed Challenge", "Master Quiz"];
  const levelBar = $("levelBar");
  levelBar.innerHTML = "";
  levels.forEach((name, i) => {
    const num = i + 1;
    const pill = document.createElement("div");
    pill.className = "level-pill";
    if (num < state.level) pill.classList.add("unlocked");
    if (num === state.level) pill.classList.add("current");
    pill.textContent = `Lv${num} ${name}`;
    levelBar.appendChild(pill);
  });

  // Table buttons 6-20
  const grid = $("tableGrid");
  grid.innerHTML = "";
  TABLES.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "table-btn";
    if (state.tablesCompleted.includes(t)) btn.classList.add("done");
    btn.innerHTML = `${t}<small>times table</small>`;
    btn.addEventListener("click", () => openLearnMode(t));
    grid.appendChild(btn);
  });

  updateStreakBadge();
}

function updateStreakBadge() {
  $("streakBadge").textContent = `🔥 ${state.dailyStreak}`;
}

/* ============================ 5. LEARN MODE ============================ */

let learnState = { table: 12, row: 0, autoPlay: false, timer: null };

function openLearnMode(table) {
  learnState.table = table;
  learnState.row = 0;
  navigateTo("learn");
}

function renderLearnTable() {
  $("learnTitle").textContent = `Table of ${learnState.table}`;
  const container = $("learnTable");
  container.innerHTML = "";
  for (let i = 1; i <= 20; i++) {
    const row = document.createElement("div");
    row.className = "learn-row";
    if (i - 1 === learnState.row) row.classList.add("highlight");
    row.textContent = `${learnState.table} × ${i} = ${learnState.table * i}`;
    container.appendChild(row);
  }
  // auto-scroll the highlighted row into view
  const highlighted = container.querySelector(".highlight");
  if (highlighted) highlighted.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function learnStep(delta) {
  learnState.row = (learnState.row + delta + 20) % 20;
  renderLearnTable();
}

function toggleLearnAutoPlay() {
  const btn = $("learnPlay");
  learnState.autoPlay = !learnState.autoPlay;
  if (learnState.autoPlay) {
    btn.classList.add("active");
    btn.textContent = "⏸ Pause";
    learnState.timer = setInterval(() => learnStep(1), 2000);
  } else {
    btn.classList.remove("active");
    btn.textContent = "▶️ Auto Play";
    clearInterval(learnState.timer);
  }
}

function readCurrentLearnRow() {
  const n = learnState.row + 1;
  speak(`${learnState.table} times ${n} equals ${learnState.table * n}`);
}

function setupLearnMode() {
  $("learnPrev").addEventListener("click", () => learnStep(-1));
  $("learnNext").addEventListener("click", () => learnStep(1));
  $("learnPlay").addEventListener("click", toggleLearnAutoPlay);
  $("learnRead").addEventListener("click", readCurrentLearnRow);
}

/* ============================ 6. QUESTION GENERATOR ============================ */

// Generates a single multiplication question from tables 6-20 (b can be 1-20)
function generateQuestion() {
  const a = pickRandom(TABLES);
  const b = randInt(1, 20);
  return { a, b, answer: a * b };
}

// Builds 4 shuffled multiple-choice options including the correct answer
function generateOptions(q) {
  const distractors = new Set();
  const candidates = [
    q.a * (q.b + 1), q.a * (q.b - 1),
    (q.a + 1) * q.b, (q.a - 1) * q.b,
    q.answer + q.a, q.answer - q.a,
    q.answer + q.b, q.answer - q.b,
    q.answer + randInt(1, 10), q.answer - randInt(1, 10),
  ];
  for (const c of shuffle(candidates)) {
    if (c > 0 && c !== q.answer && !distractors.has(c)) {
      distractors.add(c);
      if (distractors.size === 3) break;
    }
  }
  // Fallback in the rare case not enough unique distractors were found
  while (distractors.size < 3) {
    const c = q.answer + randInt(-15, 15);
    if (c > 0 && c !== q.answer) distractors.add(c);
  }
  return shuffle([q.answer, ...distractors]);
}

function recordAnswer(table, correct) {
  state.totalQuestions++;
  if (correct) state.totalCorrect++;
  const stat = state.tableStats[table];
  stat.attempts++;
  if (correct) stat.correct++;
  saveState();
}

/* ============================ 7. PRACTICE MODE ============================ */

const PRACTICE_LENGTH = 10;
let practice = { qIndex: 0, score: 0, streak: 0, questions: [], perTable: [] };

function startPractice() {
  practice = { qIndex: 0, score: 0, streak: 0, questions: [], perTable: [] };
  for (let i = 0; i < PRACTICE_LENGTH; i++) practice.questions.push(generateQuestion());
  $("practiceQTotal").textContent = PRACTICE_LENGTH;
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  const q = practice.questions[practice.qIndex];
  $("practiceScore").textContent = practice.score;
  $("practiceStreak").textContent = practice.streak;
  $("practiceQNum").textContent = practice.qIndex + 1;
  $("practiceQuestion").textContent = `${q.a} × ${q.b} = ?`;
  $("practiceFeedback").textContent = "";
  $("practiceFeedback").className = "feedback";

  const optionsEl = $("practiceOptions");
  optionsEl.innerHTML = "";
  generateOptions(q).forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => handlePracticeAnswer(opt, btn));
    optionsEl.appendChild(btn);
  });
}

function handlePracticeAnswer(chosen, btn) {
  const q = practice.questions[practice.qIndex];
  const correct = chosen === q.answer;
  const feedback = $("practiceFeedback");

  document.querySelectorAll("#practiceOptions .option-btn").forEach(b => {
    b.disabled = true;
    if (Number(b.textContent) === q.answer) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });

  if (correct) {
    practice.score++;
    practice.streak++;
    state.bestStreak = Math.max(state.bestStreak, practice.streak);
    feedback.textContent = "🎉 " + pickRandom(MOTIVATION_MESSAGES);
    feedback.classList.add("good");
    playSound("correct");
  } else {
    practice.streak = 0;
    feedback.textContent = `Not quite! ${q.a} × ${q.b} = ${q.answer}. Keep practicing!`;
    feedback.classList.add("bad");
    playSound("wrong");
  }
  recordAnswer(q.a, correct);

  setTimeout(() => {
    practice.qIndex++;
    if (practice.qIndex < PRACTICE_LENGTH) {
      renderPracticeQuestion();
    } else {
      finishPractice();
    }
  }, 1400);
}

function finishPractice() {
  const accuracy = Math.round((practice.score / PRACTICE_LENGTH) * 100);
  state.sessions++;
  state.hadPerfectRound = state.hadPerfectRound || accuracy === 100;
  if (accuracy >= 80) {
    // unlock level 3 (Speed Challenge) once practice is mastered
    if (state.level < 3) state.level = 3;
  }
  updateStreakTracking();
  addToLeaderboard("Practice", practice.score, accuracy);
  saveState();

  showResults({
    title: accuracy >= 80 ? "Level Up!" : "Practice Complete",
    stats: [`Score: ${practice.score}/${PRACTICE_LENGTH}`, `Accuracy: ${accuracy}%`],
    stars: accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 40 ? 1 : 0,
    onClose: () => navigateTo("home"),
  });
}

/* ============================ 8. TIMED (SPEED) CHALLENGE ============================ */

const TIMED_LENGTH = 20;
const TIMED_SECONDS = 60;
let timed = { qIndex: 0, score: 0, questions: [], secondsLeft: TIMED_SECONDS, timerId: null, startTime: 0, active: false };

function setupTimedChallenge() {
  $("timedStartBtn").addEventListener("click", startTimedChallenge);
}

function startTimedChallenge() {
  timed = { qIndex: 0, score: 0, questions: [], secondsLeft: TIMED_SECONDS, timerId: null, startTime: Date.now(), active: true };
  for (let i = 0; i < TIMED_LENGTH; i++) timed.questions.push(generateQuestion());

  $("timedStartWrap").style.display = "none";
  $("timedQuestionCard").style.display = "block";
  $("timedScore").textContent = 0;

  timed.timerId = setInterval(tickTimedClock, 1000);
  renderTimedQuestion();
}

function tickTimedClock() {
  timed.secondsLeft--;
  const clock = $("timedClock");
  clock.textContent = timed.secondsLeft;
  clock.parentElement.classList.toggle("low-time", timed.secondsLeft <= 10);
  if (timed.secondsLeft <= 0) finishTimedChallenge();
}

function renderTimedQuestion() {
  if (timed.qIndex >= TIMED_LENGTH) { finishTimedChallenge(); return; }
  const q = timed.questions[timed.qIndex];
  $("timedQNum").textContent = timed.qIndex + 1;
  $("timedQuestion").textContent = `${q.a} × ${q.b} = ?`;

  const optionsEl = $("timedOptions");
  optionsEl.innerHTML = "";
  generateOptions(q).forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleTimedAnswer(opt));
    optionsEl.appendChild(btn);
  });
}

function handleTimedAnswer(chosen) {
  if (!timed.active) return;
  const q = timed.questions[timed.qIndex];
  const correct = chosen === q.answer;
  if (correct) { timed.score++; playSound("correct"); } else { playSound("wrong"); }
  recordAnswer(q.a, correct);
  $("timedScore").textContent = timed.score;
  timed.qIndex++;
  renderTimedQuestion();
}

function finishTimedChallenge() {
  if (!timed.active) return;
  timed.active = false;
  clearInterval(timed.timerId);
  const timeTaken = Math.round((Date.now() - timed.startTime) / 1000);
  const attempted = timed.qIndex;
  const accuracy = attempted > 0 ? Math.round((timed.score / attempted) * 100) : 0;
  const stars = timed.score >= 18 ? 3 : timed.score >= 12 ? 2 : timed.score >= 6 ? 1 : 0;

  state.bestTimedStars = Math.max(state.bestTimedStars, stars);
  state.highestScore = Math.max(state.highestScore, timed.score);
  if (stars >= 2 && state.level < 4) state.level = 4;
  updateStreakTracking();
  addToLeaderboard("Speed Challenge", timed.score, accuracy);
  saveState();

  $("timedQuestionCard").style.display = "none";
  $("timedStartWrap").style.display = "block";

  showResults({
    title: "Speed Challenge Complete!",
    stats: [`Score: ${timed.score}/${TIMED_LENGTH}`, `Accuracy: ${accuracy}%`, `Time: ${timeTaken}s`],
    stars,
    onClose: () => navigateTo("home"),
  });
}

/* ============================ 9. FLASH CARDS ============================ */

let flash = { card: null, flipped: false };

function startFlashcards() {
  nextFlashcard();
  $("flashcardInner").classList.remove("flipped");
  flash.flipped = false;
}

function nextFlashcard() {
  const q = generateQuestion();
  flash.card = q;
  flash.flipped = false;
  $("flashcardInner").classList.remove("flipped");
  $("flashcardFront").textContent = `${q.a} × ${q.b}`;
  $("flashcardBack").textContent = q.answer;
}

function flipFlashcard() {
  flash.flipped = !flash.flipped;
  $("flashcardInner").classList.toggle("flipped", flash.flipped);
}

function setupFlashcards() {
  $("flashcard").addEventListener("click", flipFlashcard);
  $("flashNext").addEventListener("click", nextFlashcard);
  $("flashPrev").addEventListener("click", nextFlashcard);
  $("flashRead").addEventListener("click", () => {
    const q = flash.card;
    speak(`${q.a} times ${q.b} equals ${q.answer}`);
  });
}

/* ============================ 10. FILL THE MISSING NUMBER ============================ */

let fillState = { a: 12, b: 1, answer: 12, missing: "b", score: 0 };

function nextFillQuestion() {
  const q = generateQuestion();
  // Randomly hide the first factor, second factor, or the product
  const missingSlot = pickRandom(["a", "b", "product"]);
  fillState = { a: q.a, b: q.b, answer: q.answer, missing: missingSlot };

  let text;
  if (missingSlot === "a") text = `? × ${q.b} = ${q.answer}`;
  else if (missingSlot === "b") text = `${q.a} × ? = ${q.answer}`;
  else text = `${q.a} × ${q.b} = ?`;

  $("fillQuestion").textContent = text;
  $("fillInput").value = "";
  $("fillFeedback").textContent = "";
  $("fillFeedback").className = "feedback";
  $("fillScore").textContent = fillState.score;
}

function checkFillAnswer() {
  const val = Number($("fillInput").value);
  let correctVal;
  if (fillState.missing === "a") correctVal = fillState.a;
  else if (fillState.missing === "b") correctVal = fillState.b;
  else correctVal = fillState.answer;

  const correct = val === correctVal;
  const feedback = $("fillFeedback");
  recordAnswer(fillState.a, correct);

  if (correct) {
    fillState.score++;
    feedback.textContent = "🎉 " + pickRandom(MOTIVATION_MESSAGES);
    feedback.classList.add("good");
    playSound("correct");
  } else {
    feedback.textContent = `The missing number was ${correctVal}.`;
    feedback.classList.add("bad");
    playSound("wrong");
  }
  saveState();
  setTimeout(nextFillQuestion, 1300);
}

function setupFillMissing() {
  $("fillSubmit").addEventListener("click", checkFillAnswer);
  $("fillInput").addEventListener("keydown", e => { if (e.key === "Enter") checkFillAnswer(); });
}

/* ============================ 11. DAILY CHALLENGE ============================ */

const DAILY_LENGTH = 5;
let daily = { qIndex: 0, score: 0, questions: [] };

function startDailyChallenge() {
  $("dailyDate").textContent = `Today's ${DAILY_LENGTH} special questions! (${todayStr()})`;

  if (state.dailyChallenge.date === todayStr() && state.dailyChallenge.completed) {
    $("dailyQuestionCard").style.display = "none";
    $("dailyDoneMsg").style.display = "block";
    return;
  }
  $("dailyQuestionCard").style.display = "block";
  $("dailyDoneMsg").style.display = "none";

  // Seed questions deterministically from the date so all players get the same set
  daily = { qIndex: 0, score: 0, questions: [] };
  const seed = todayStr().split("-").join("");
  for (let i = 0; i < DAILY_LENGTH; i++) {
    const a = TABLES[(Number(seed) + i * 7) % TABLES.length];
    const b = ((Number(seed) + i * 13) % 20) + 1;
    daily.questions.push({ a, b, answer: a * b });
  }
  renderDailyQuestion();
}

function renderDailyQuestion() {
  const q = daily.questions[daily.qIndex];
  $("dailyScore").textContent = daily.score;
  $("dailyQuestion").textContent = `${q.a} × ${q.b} = ?`;
  $("dailyFeedback").textContent = "";
  $("dailyFeedback").className = "feedback";

  const optionsEl = $("dailyOptions");
  optionsEl.innerHTML = "";
  generateOptions(q).forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleDailyAnswer(opt));
    optionsEl.appendChild(btn);
  });
}

function handleDailyAnswer(chosen) {
  const q = daily.questions[daily.qIndex];
  const correct = chosen === q.answer;
  if (correct) { daily.score++; playSound("correct"); } else { playSound("wrong"); }
  recordAnswer(q.a, correct);

  const feedback = $("dailyFeedback");
  feedback.textContent = correct ? "🎉 " + pickRandom(MOTIVATION_MESSAGES) : `${q.a} × ${q.b} = ${q.answer}`;
  feedback.className = "feedback " + (correct ? "good" : "bad");

  setTimeout(() => {
    daily.qIndex++;
    if (daily.qIndex < DAILY_LENGTH) {
      renderDailyQuestion();
    } else {
      finishDailyChallenge();
    }
  }, 1200);
}

function finishDailyChallenge() {
  state.dailyChallenge = { date: todayStr(), completed: true, score: daily.score };
  state.dailyCompletedCount = (state.dailyCompletedCount || 0) + 1;
  updateStreakTracking();
  saveState();

  showResults({
    title: "Daily Challenge Complete!",
    stats: [`Score: ${daily.score}/${DAILY_LENGTH}`],
    stars: daily.score >= 5 ? 3 : daily.score >= 3 ? 2 : daily.score >= 1 ? 1 : 0,
    onClose: () => navigateTo("home"),
  });
}

// Updates the daily login streak (once per calendar day)
function updateStreakTracking() {
  const today = todayStr();
  if (state.lastStreakDate === today) return; // already counted today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.dailyStreak = state.lastStreakDate === yesterday ? state.dailyStreak + 1 : 1;
  state.lastStreakDate = today;
  state.lastPlayedDate = today;
  updateStreakBadge();
}

/* ============================ 12. MASTER QUIZ (LEVEL 4) ============================ */

const MASTER_LENGTH = 10;
let master = { qIndex: 0, score: 0, questions: [] };

function startMasterQuiz() {
  master = { qIndex: 0, score: 0, questions: [] };
  for (let i = 0; i < MASTER_LENGTH; i++) master.questions.push(generateQuestion());
  $("masterQTotal").textContent = MASTER_LENGTH;
  renderMasterQuestion();
}

function renderMasterQuestion() {
  const q = master.questions[master.qIndex];
  $("masterScore").textContent = master.score;
  $("masterQNum").textContent = master.qIndex + 1;
  $("masterQuestion").textContent = `${q.a} × ${q.b} = ?`;
  $("masterInput").value = "";
  $("masterFeedback").textContent = "";
  $("masterFeedback").className = "feedback";
  $("masterInput").focus();
}

function submitMasterAnswer() {
  const q = master.questions[master.qIndex];
  const val = Number($("masterInput").value);
  const correct = val === q.answer;
  recordAnswer(q.a, correct);

  const feedback = $("masterFeedback");
  if (correct) {
    master.score++;
    feedback.textContent = "🎉 " + pickRandom(MOTIVATION_MESSAGES);
    feedback.classList.add("good");
    playSound("correct");
  } else {
    feedback.textContent = `${q.a} × ${q.b} = ${q.answer}`;
    feedback.classList.add("bad");
    playSound("wrong");
  }

  setTimeout(() => {
    master.qIndex++;
    if (master.qIndex < MASTER_LENGTH) {
      renderMasterQuestion();
    } else {
      finishMasterQuiz();
    }
  }, 1300);
}

function finishMasterQuiz() {
  const accuracy = Math.round((master.score / MASTER_LENGTH) * 100);
  state.hadPerfectRound = state.hadPerfectRound || accuracy === 100;
  updateStreakTracking();
  addToLeaderboard("Master Quiz", master.score, accuracy);
  saveState();

  showResults({
    title: accuracy >= 80 ? "You're a Times Table Master!" : "Master Quiz Complete",
    stats: [`Score: ${master.score}/${MASTER_LENGTH}`, `Accuracy: ${accuracy}%`],
    stars: accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 40 ? 1 : 0,
    onClose: () => navigateTo("home"),
  });
}

function setupMasterQuiz() {
  $("masterSubmit").addEventListener("click", submitMasterAnswer);
  $("masterInput").addEventListener("keydown", e => { if (e.key === "Enter") submitMasterAnswer(); });
}

/* ============================ 13. PRINTABLE WORKSHEET ============================ */

function initWorksheetScreen() {
  const select = $("worksheetTable");
  if (select.options.length === 0) {
    TABLES.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = `Table of ${t}`;
      select.appendChild(opt);
    });
  }
  generateWorksheet();
}

function generateWorksheet() {
  const table = Number($("worksheetTable").value);
  const count = Number($("worksheetCount").value);
  const preview = $("worksheetPreview");

  let html = `<h2>Multiplication Worksheet: Table of ${table}</h2><ol>`;
  for (let i = 0; i < count; i++) {
    const b = randInt(1, 20);
    html += `<li>${table} × ${b} = ______</li>`;
  }
  html += "</ol>";
  preview.innerHTML = html;
}

function setupWorksheet() {
  $("worksheetGenerate").addEventListener("click", generateWorksheet);
  $("worksheetPrint").addEventListener("click", () => {
    $("screen-worksheet").classList.add("printing");
    window.print();
    $("screen-worksheet").classList.remove("printing");
  });
}

/* ============================ 14. ACHIEVEMENTS ============================ */

function checkAchievements() {
  let newlyEarned = [];
  ACHIEVEMENT_LIST.forEach(a => {
    if (!state.achievements.includes(a.id) && a.check(state)) {
      state.achievements.push(a.id);
      newlyEarned.push(a);
    }
  });
  if (newlyEarned.length) saveState();
  return newlyEarned;
}

function renderAchievements() {
  checkAchievements();
  const grid = $("badgeGrid");
  grid.innerHTML = "";
  ACHIEVEMENT_LIST.forEach(a => {
    const earned = state.achievements.includes(a.id);
    const card = document.createElement("div");
    card.className = "badge-card" + (earned ? " earned" : "");
    card.innerHTML = `<span class="badge-icon">${a.icon}</span><span class="badge-name">${a.name}</span>`;
    grid.appendChild(card);
  });
}

/* ============================ 15. LEADERBOARD ============================ */

function addToLeaderboard(mode, score, accuracy) {
  const name = state.settings.name || "Superstar";
  state.leaderboard.push({ name, mode, score, accuracy, date: todayStr() });
  state.leaderboard.sort((a, b) => b.score - a.score);
  state.leaderboard = state.leaderboard.slice(0, 10);
  checkAchievements();
}

function renderLeaderboard() {
  const list = $("leaderboardList");
  list.innerHTML = "";
  if (state.leaderboard.length === 0) {
    list.innerHTML = "<li>No scores yet. Play a mode to get on the board!</li>";
    return;
  }
  state.leaderboard.forEach((entry, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>#${i + 1} ${entry.name} — ${entry.mode}</span><span>${entry.score} pts (${entry.accuracy}%)</span>`;
    list.appendChild(li);
  });
}

/* ============================ 16. PARENT DASHBOARD ============================ */

function renderDashboard() {
  $("dashSessions").textContent = state.sessions;
  $("dashQuestions").textContent = state.totalQuestions;
  $("dashCorrect").textContent = state.totalCorrect;
  const progress = state.totalQuestions > 0 ? Math.round((state.totalCorrect / state.totalQuestions) * 100) : 0;
  $("dashProgress").textContent = progress + "%";

  const strong = [], weak = [];
  TABLES.forEach(t => {
    const stat = state.tableStats[t];
    if (stat.attempts === 0) return;
    const acc = stat.correct / stat.attempts;
    if (acc >= 0.8) strong.push(t); else if (acc < 0.6) weak.push(t);
  });

  $("dashStrong").innerHTML = strong.length ? strong.map(t => `<span>${t}×</span>`).join("") : "<span>Keep practicing!</span>";
  $("dashWeak").innerHTML = weak.length ? weak.map(t => `<span>${t}×</span>`).join("") : "<span>None — great job!</span>";

  // Recompute which tables count as "completed" (>=80% accuracy, at least 5 attempts)
  state.tablesCompleted = TABLES.filter(t => {
    const stat = state.tableStats[t];
    return stat.attempts >= 5 && stat.correct / stat.attempts >= 0.8;
  });
  saveState();
}

function setupDashboard() {
  $("dashResetBtn").addEventListener("click", resetProgress);
}

/* ============================ 17. SETTINGS ============================ */

function applySettings() {
  document.body.classList.toggle("dark", state.settings.dark);
  document.body.className = document.body.className.replace(/font-\w+/g, "").trim();
  document.body.classList.add("font-" + state.settings.fontSize);
  if (state.settings.dark) document.body.classList.add("dark");
}

function renderSettingsScreen() {
  $("settingSound").checked = state.settings.sound;
  $("settingDark").checked = state.settings.dark;
  $("settingFontSize").value = state.settings.fontSize;
  $("settingName").value = state.settings.name;
}

function setupSettings() {
  $("settingSound").addEventListener("change", e => { state.settings.sound = e.target.checked; saveState(); });
  $("settingDark").addEventListener("change", e => { state.settings.dark = e.target.checked; applySettings(); saveState(); });
  $("settingFontSize").addEventListener("change", e => { state.settings.fontSize = e.target.value; applySettings(); saveState(); });
  $("settingName").addEventListener("input", e => { state.settings.name = e.target.value; saveState(); });
  $("settingResetBtn").addEventListener("click", resetProgress);
  renderSettingsScreen();
}

function resetProgress() {
  if (!confirm("Are you sure you want to reset all progress? This cannot be undone.")) return;
  const keepSettings = state.settings;
  state = defaultState();
  state.settings = keepSettings;
  saveState();
  renderHome();
  renderSettingsScreen();
  alert("Progress has been reset.");
}

/* ============================ 18. REWARDS: OVERLAY, STARS, CONFETTI, SOUND, SPEECH ============================ */

function showResults({ title, stats, stars, onClose }) {
  $("resultsTitle").textContent = title;
  $("resultsMessage").textContent = pickRandom(MOTIVATION_MESSAGES);
  $("resultsStats").innerHTML = stats.map(s => `<div>${s}</div>`).join("");
  $("rewardAnim").textContent = stars === 3 ? "🏆" : stars >= 1 ? "⭐" : "💪";

  const starsRow = $("starsRow");
  starsRow.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const span = document.createElement("span");
    span.textContent = "⭐";
    if (i < stars) span.classList.add("lit");
    starsRow.appendChild(span);
  }

  const newBadges = checkAchievements();
  if (newBadges.length) {
    $("resultsStats").innerHTML += `<div>New Badge: ${newBadges[0].icon} ${newBadges[0].name}</div>`;
  }

  $("resultsOverlay").classList.add("show");
  if (stars === 3) launchConfetti();

  const closeHandler = () => {
    $("resultsOverlay").classList.remove("show");
    $("resultsCloseBtn").removeEventListener("click", closeHandler);
    if (onClose) onClose();
  };
  $("resultsCloseBtn").addEventListener("click", closeHandler);
}

// Simple WebAudio beep so we don't need external sound files
let audioCtx = null;
function playSound(type) {
  if (!state.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = type === "correct" ? 880 : 220;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) { /* audio not supported; fail silently */ }
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.9;
  utter.pitch = 1.1;
  window.speechSynthesis.speak(utter);
}

// Lightweight canvas confetti burst for perfect scores
function launchConfetti() {
  const canvas = $("confettiCanvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");
  const colors = ["#ff6b6b", "#ffd93d", "#6c5ce7", "#00cec9", "#51cf66", "#f783ac"];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height,
    size: 6 + Math.random() * 6,
    speed: 2 + Math.random() * 4,
    drift: -2 + Math.random() * 4,
    color: pickRandom(colors),
    rotation: Math.random() * 360,
  }));

  let frames = 0;
  const maxFrames = 180;
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.speed;
      p.x += p.drift;
      p.rotation += 5;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    frames++;
    if (frames < maxFrames) {
      requestAnimationFrame(frame);
    } else {
      canvas.style.display = "none";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(frame);
}

/* ============================ 19. INIT ============================ */

function init() {
  applySettings();
  setupNavigation();
  setupLearnMode();
  setupTimedChallenge();
  setupFlashcards();
  setupFillMissing();
  setupMasterQuiz();
  setupWorksheet();
  setupDashboard();
  setupSettings();

  renderLearnTable();
  renderHome();
  navigateTo("home");
}

document.addEventListener("DOMContentLoaded", init);
