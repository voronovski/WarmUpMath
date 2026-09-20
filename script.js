let quizData = [];
let currentIndex = 0;
let perQuestionTime = 10;
let timer = null;
let timeLeft = 0;
let totalTimeSpent = 0;
let currentRubric = "";
let currentDifficulty = "";
let fireworksAnimationId = null;
let isMarathon = false;
let marathonLegs = [];

const MARATHON_RUBRICS = ["addition", "multiplication", "subtraction", "division"];
const MARATHON_QUESTIONS_PER_LEG = 15;

// Elements
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultsScreen = document.getElementById("results-screen");

const rubricName = document.getElementById("rubric-name");
const questionNumber = document.getElementById("question-number");
const progressFill = document.getElementById("progress-bar-fill");
const problemStatement = document.getElementById("problem-statement");
const answerInput = document.getElementById("answer");

const showOnlyErrorsChk = document.getElementById("only-errors-chk");

document.getElementById("start-btn").onclick = startQuiz;
document.getElementById("next-btn").onclick = nextQuestion;
document.getElementById("quit-btn").onclick = finishQuiz;
document.getElementById("back-btn").onclick = () => {
  clearInterval(timer);
  quizScreen.style.display = "none";
  startScreen.style.display = "block";
};
document.getElementById("marathon-btn").onclick = startMarathon;
document.getElementById("restart-btn").onclick = () => {
  if (isMarathon) startMarathon();
  else startQuiz();
};
document.getElementById("home-btn").onclick = () => {
  stopFireworks();
  resultsScreen.style.display = "none";
  startScreen.style.display = "block";
  renderHistoryChart();
  renderMarathonChart();
  renderAttemptsHistory();
};

showOnlyErrorsChk.addEventListener("change", e => {
  showResults();
});

const SETTINGS_KEY = "quizSettings";

function saveSettings() {
  const settings = {
    rubric: document.getElementById("rubric").value,
    difficulty: document.getElementById("difficulty").value,
    marathonDifficulty: document.getElementById("marathon-difficulty").value,
    numQuestions: document.getElementById("num-questions").value,
    timeLimit: document.getElementById("time-limit").value,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function restoreSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;

  let settings;
  try {
    settings = JSON.parse(raw);
  } catch (e) {
    return;
  }

  if (settings.rubric) document.getElementById("rubric").value = settings.rubric;
  if (settings.difficulty) document.getElementById("difficulty").value = settings.difficulty;
  if (settings.marathonDifficulty) document.getElementById("marathon-difficulty").value = settings.marathonDifficulty;
  if (settings.numQuestions) document.getElementById("num-questions").value = settings.numQuestions;
  if (settings.timeLimit) document.getElementById("time-limit").value = settings.timeLimit;
}

restoreSettings();

// Button-group controls (replace what used to be <select> dropdowns) -------
// The hidden <input id="rubric">/<input id="difficulty"> keep the same
// id/.value contract the rest of the app already reads, so nothing else
// needs to change.
function setGroupValue(group, hiddenInput, value) {
  hiddenInput.value = value;
  group.querySelectorAll(".option-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.value === value)
  );
}

function initButtonGroup(groupId, hiddenInputId) {
  const group = document.getElementById(groupId);
  const hiddenInput = document.getElementById(hiddenInputId);

  group.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setGroupValue(group, hiddenInput, btn.dataset.value);
      hiddenInput.dispatchEvent(new Event("change"));
    });
  });

  setGroupValue(group, hiddenInput, hiddenInput.value);
}

initButtonGroup("rubric-group", "rubric");
initButtonGroup("difficulty-group", "difficulty");
initButtonGroup("marathon-difficulty-group", "marathon-difficulty");

// Mode tabs (Session / Marathon / Generate) ----------------------------------
const TAB_PANELS = {
  session: document.getElementById("session-tab"),
  marathon: document.getElementById("marathon-tab"),
  generate: document.getElementById("generate-tab"),
};

const attemptsHistorySection = document.getElementById("attempts-history-section");

document.getElementById("mode-tabs").querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    Object.entries(TAB_PANELS).forEach(([key, panel]) => {
      panel.style.display = key === btn.dataset.tab ? "block" : "none";
    });
    attemptsHistorySection.style.display = btn.dataset.tab === "generate" ? "none" : "block";
  });
});

// History chart -------------------------------------------------------------
// Each completed (or quit) session is recorded as an error RATE (%), not a
// raw error count. This is what makes sessions comparable: a raw count
// depends on how many questions the session had and how often you practice,
// while errors/total is a stable accuracy signal regardless of session size
// or how much time passed between sessions. Sessions are plotted in the
// order they happened (attempt #1, #2, ...) rather than by calendar date,
// so irregular practice frequency doesn't distort the shape of the trend.
const HISTORY_KEY = "quizHistory";
const MARATHON_HISTORY_KEY = "marathonHistory";
const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const RUBRIC_COLORS = {
  addition: "#2ecc71",
  subtraction: "#e74c3c",
  multiplication: "#3498db",
  division: "#9b59b6",
};
const GRADE_ORDER = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
const TOP_CHART_SESSION_LIMIT = 200;
const MARATHON_CHART_SESSION_LIMIT = 100;

const historyChartCanvas = document.getElementById("history-chart");
const rubricInput = document.getElementById("rubric");
const difficultySelect = document.getElementById("difficulty");
const marathonDifficultySelect = document.getElementById("marathon-difficulty");

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

// Each (rubric, difficulty) combo keeps only its most recent
// TOP_CHART_SESSION_LIMIT sessions — older ones are dropped on write so
// storage doesn't grow without bound.
function recordHistoryEntry(rubric, difficulty, total, correct) {
  if (!VALID_DIFFICULTIES.includes(difficulty) || total <= 0) return;

  const history = loadHistory();
  history.push({
    rubric,
    difficulty,
    date: Date.now(),
    total,
    correct,
    errorRate: (total - correct) / total * 100,
  });

  const combo = history.filter(e => e.rubric === rubric && e.difficulty === difficulty);
  if (combo.length > TOP_CHART_SESSION_LIMIT) {
    const toDrop = combo.length - TOP_CHART_SESSION_LIMIT;
    let dropped = 0;
    const trimmed = history.filter(e => {
      if (e.rubric === rubric && e.difficulty === difficulty && dropped < toDrop) {
        dropped++;
        return false;
      }
      return true;
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } else {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
}

function renderHistoryChart() {
  const ctx = historyChartCanvas.getContext("2d");
  const w = historyChartCanvas.width;
  const h = historyChartCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const padding = { top: 15, right: 15, bottom: 30, left: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const rubric = rubricInput.value;
  const difficulty = difficultySelect.value;
  const points = loadHistory()
    .filter(e => e.rubric === rubric && e.difficulty === difficulty)
    .slice(-TOP_CHART_SESSION_LIMIT);

  // Axes
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plotH);
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.stroke();

  // Y axis gridlines + labels (error rate %)
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "right";
  [0, 25, 50, 75, 100].forEach(v => {
    const y = padding.top + (v / 100) * plotH;
    ctx.strokeStyle = "#eee";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();

    ctx.fillStyle = "#666";
    ctx.fillText(v + "%", padding.left - 6, y + 3);
  });

  if (points.length === 0) {
    ctx.fillStyle = "#999";
    ctx.textAlign = "center";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText("No completed sessions yet for this rubric/difficulty", w / 2, h / 2);
    return;
  }

  const xStep = points.length > 1 ? plotW / (points.length - 1) : 0;
  const color = RUBRIC_COLORS[rubric] || "#333";

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + (p.errorRate / 100) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((p, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + (p.errorRate / 100) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#666";
  ctx.textAlign = "center";
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText("Session #", padding.left + plotW / 2, h - 6);
}

rubricInput.addEventListener("change", renderHistoryChart);
difficultySelect.addEventListener("change", renderHistoryChart);

renderHistoryChart();

// Marathon grade chart --------------------------------------------------
// Plots the overall letter grade of each completed marathon (all 4 legs
// combined) over time, so progress reads the same way a report card would.
const marathonChartCanvas = document.getElementById("marathon-chart");
const MARATHON_LINE_COLOR = "#e67e22";

function loadMarathonHistory() {
  try {
    return JSON.parse(localStorage.getItem(MARATHON_HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function recordMarathonHistoryEntry(difficulty, total, correct) {
  if (!VALID_DIFFICULTIES.includes(difficulty) || total <= 0) return;

  const history = loadMarathonHistory();
  history.push({
    difficulty,
    date: Date.now(),
    total,
    correct,
    grade: getLetterGrade((correct / total) * 100),
  });
  localStorage.setItem(MARATHON_HISTORY_KEY, JSON.stringify(history));
}

function renderMarathonChart() {
  const ctx = marathonChartCanvas.getContext("2d");
  const w = marathonChartCanvas.width;
  const h = marathonChartCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const padding = { top: 15, right: 15, bottom: 30, left: 40 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const difficulty = marathonDifficultySelect.value;
  const points = loadMarathonHistory()
    .filter(e => e.difficulty === difficulty)
    .slice(-MARATHON_CHART_SESSION_LIMIT);

  // Axes
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plotH);
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.stroke();

  // Y axis gridlines + labels (every letter grade, including +/- steps)
  ctx.font = "10px Arial, sans-serif";
  ctx.textAlign = "right";
  const maxGradeIdx = GRADE_ORDER.length - 1;
  GRADE_ORDER.forEach((grade, idx) => {
    const y = padding.top + plotH - (idx / maxGradeIdx) * plotH;
    ctx.strokeStyle = "#eee";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();

    ctx.fillStyle = "#666";
    ctx.fillText(grade, padding.left - 6, y + 3);
  });

  if (points.length === 0) {
    ctx.fillStyle = "#999";
    ctx.textAlign = "center";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText("No completed marathons yet for this difficulty", w / 2, h / 2);
    return;
  }

  const xStep = points.length > 1 ? plotW / (points.length - 1) : 0;

  ctx.strokeStyle = MARATHON_LINE_COLOR;
  ctx.fillStyle = MARATHON_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const idx = GRADE_ORDER.indexOf(p.grade);
    const x = padding.left + i * xStep;
    const y = padding.top + plotH - (idx / maxGradeIdx) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((p, i) => {
    const idx = GRADE_ORDER.indexOf(p.grade);
    const x = padding.left + i * xStep;
    const y = padding.top + plotH - (idx / maxGradeIdx) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#666";
  ctx.textAlign = "center";
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText("Marathon #", padding.left + plotW / 2, h - 6);
}

marathonDifficultySelect.addEventListener("change", renderMarathonChart);

renderMarathonChart();

// ENTER key submits
answerInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && answerInput.value != "") nextQuestion();
});

// Start game
function startQuiz() {
  const rubric = document.getElementById("rubric").value;
  const difficulty = document.getElementById("difficulty").value;
  const numQ = parseInt(document.getElementById("num-questions").value);
  perQuestionTime = parseInt(document.getElementById("time-limit").value);

  currentRubric = rubric;
  currentDifficulty = difficulty;
  isMarathon = false;

  stopFireworks();
  saveSettings();

  quizData = generateQuestions(rubric, difficulty, numQ);
  currentIndex = 0;
  totalTimeSpent = 0;

  startScreen.style.display = "none";
  quizScreen.style.display = "block";

  rubricName.textContent = capitalize(rubric);

  loadQuestion();
}

// Marathon: chains one 15-question session of each core rubric back-to-back,
// using whatever difficulty is currently selected on the form.
function startMarathon() {
  const difficulty = document.getElementById("marathon-difficulty").value;
  perQuestionTime = parseInt(document.getElementById("time-limit").value);

  currentDifficulty = difficulty;
  currentRubric = "marathon";
  isMarathon = true;
  marathonLegs = MARATHON_RUBRICS.slice();

  stopFireworks();
  saveSettings();

  quizData = [];
  marathonLegs.forEach(rubric => {
    const legQuestions = generateQuestions(rubric, difficulty, MARATHON_QUESTIONS_PER_LEG);
    legQuestions.forEach(q => q.rubric = rubric);
    quizData = quizData.concat(legQuestions);
  });

  currentIndex = 0;
  totalTimeSpent = 0;

  startScreen.style.display = "none";
  quizScreen.style.display = "block";

  rubricName.textContent = "Marathon";

  loadQuestion();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Addition/subtraction difficulty is defined by which carry/borrow pattern
// is used, not just by how large the numbers are — this is a much more
// reliable signal of actual difficulty than a bigger random range.
const ADDITION_PATTERNS = {
  a2: function() {
    // 10 < sum < 18 (single digits, crosses a ten)
    let a = rand(2, 9);
    let b = rand(11 - a, 9);
    let ans = a + b;
    return [`${a} + ${b} =`, ans];
  },
  a3: function() {
    // large a, small b, sum doesn't cross the next ten (no carry)
    let a = rand(11, 99);
    let b = rand(1, 10 - a % 10);
    let ans = a + b;
    return [`${a} + ${b} =`, ans];
  },
  a4: function() {
    // large a, small b, sum crosses the next ten (requires carrying)
    let a = rand(2, 9);
    let b = rand(11 - a, 9);
    a += rand(1, 8) * 10;
    let ans = a + b;
    return [`${a} + ${b} =`, ans];
  },
  a5: function() {
    // large a, large b, sum of ones doesn't cross a ten (no carry)
    let a_1 = rand(1, 9);
    let b_1 = rand(1, 10 - a_1);
    let tens = rand(1, 8);
    let a = tens * 10 + a_1;
    let b = rand(1, 9 - tens) * 10 + b_1;
    let ans = a + b;
    return [`${a} + ${b} =`, ans];
  },
};

const SUBTRACTION_PATTERNS = {
  s2: function() {
    // a = 10
    let a = 10;
    let b = rand(1, 10);
    let ans = a - b;
    return [`${a} - ${b} =`, ans];
  },
  s3: function() {
    // a = 10*k, b < 10
    let a = rand(2, 10) * 10;
    let b = rand(1, 10);
    let ans = a - b;
    return [`${a} - ${b} =`, ans];
  },
  s4: function() {
    // large a, small b, diff doesn't cross a ten (no borrow)
    let a = rand(11, 99);
    let b = rand(1, a % 10);
    let ans = a - b;
    return [`${a} - ${b} =`, ans];
  },
  s5: function() {
    // large a, small b, diff crosses a ten (requires borrowing)
    let m = rand(1, 9);
    let k = rand(1, 8);
    let a = 10 * m + k;
    let b = rand(k + 1, 9);
    let ans = a - b;
    return [`${a} - ${b} =`, ans];
  },
  s6: function() {
    // large a, large b, diff doesn't cross a ten (no borrow)
    let m = rand(2, 9);
    let k = rand(2, 9);
    let a = 10 * m + k;
    let b = 10 * rand(1, m) + rand(1, k);
    let ans = a - b;
    return [`${a} - ${b} =`, ans];
  },
  s7: function() {
    // large a, large b, diff crosses a ten (requires borrowing)
    let m = rand(2, 9);
    let k = rand(2, 8);
    let a = 10 * m + k;
    let b = 10 * rand(1, m - 1) + rand(k, 9);
    let ans = a - b;
    return [`${a} - ${b} =`, ans];
  },
};

const DIFFICULTY_PATTERNS = {
  addition: {
    easy: [ADDITION_PATTERNS.a2],
    medium: [ADDITION_PATTERNS.a3, ADDITION_PATTERNS.a5],
    hard: [ADDITION_PATTERNS.a4],
  },
  subtraction: {
    easy: [SUBTRACTION_PATTERNS.s2],
    medium: [SUBTRACTION_PATTERNS.s3, SUBTRACTION_PATTERNS.s4, SUBTRACTION_PATTERNS.s6],
    hard: [SUBTRACTION_PATTERNS.s5, SUBTRACTION_PATTERNS.s7],
  },
};

function pickPattern(rubric, difficulty) {
  const patterns = DIFFICULTY_PATTERNS[rubric][difficulty];
  return patterns[rand(0, patterns.length - 1)]();
}

// Multiplication/division difficulty is how far up the times table you go —
// both factors are drawn from the same range, since division is just
// multiplication worked backwards.
const MULTIPLICATION_TABLE_RANGES = {
  easy: [2, 5],
  medium: [2, 10],
  hard: [2, 12],
};

function pickTableFactors(difficulty) {
  const [min, max] = MULTIPLICATION_TABLE_RANGES[difficulty];
  return [rand(min, max), rand(min, max)];
}

function generateQuestions(rubric, difficulty, count) {
  const list = [];
  let retries = 0;
  const maxRetries = 3;

  for (let i = 0; i < count; i++) {
    let a, b;
    let text = "",
      ans = 0;

    switch (rubric) {
      case "addition":
      case "subtraction":
        [text, ans] = pickPattern(rubric, difficulty);
        break;
      case "multiplication":
        [a, b] = pickTableFactors(difficulty);
        text = `${a} × ${b} =`;
        ans = a * b;
        break;
      case "division":
        [ans, b] = pickTableFactors(difficulty);
        a = ans * b;
        text = `${a} ÷ ${b} =`;
        break;
    }

    // Regen if it's a duplicate question.
    if (list.length > 0 &&
      list[list.length - 1].question == text &&
      retries++ < maxRetries) {
      i--;
      continue
    }

    retries = 0;

    list.push({
      question: text,
      correct: ans,
      userAnswer: null,
      timeSpent: 0
    });
  }

  return list;
}

function rand(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function loadQuestion() {
  const q = quizData[currentIndex];
  questionNumber.textContent = currentIndex + 1;

  if (isMarathon && q.rubric) {
    rubricName.textContent = `Marathon: ${capitalize(q.rubric)}`;
  }

  problemStatement.textContent = q.question;
  answerInput.value = "";
  answerInput.focus();

  timeLeft = perQuestionTime;
  progressFill.style.width = "100%";

  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    timeLeft--;
    progressFill.style.width = (timeLeft / perQuestionTime * 100) + "%";

    if (timeLeft <= 0) nextQuestion();
  }, 1000);
}

function nextQuestion() {
  const q = quizData[currentIndex];

  q.userAnswer = answerInput.value.trim();
  q.timeSpent = perQuestionTime - timeLeft;
  totalTimeSpent += q.timeSpent;

  currentIndex++;

  if (currentIndex >= quizData.length) {
    finishQuiz();
  } else {
    loadQuestion();
  }
}

function finishQuiz() {
  showOnlyErrorsChk.checked = true;

  if (isMarathon) {
    marathonLegs.forEach(rubric => {
      const legQuestions = quizData.filter(q => q.rubric === rubric);
      const legCorrect = legQuestions.filter(q => parseFloat(q.userAnswer) == q.correct).length;
      recordHistoryEntry(rubric, currentDifficulty, legQuestions.length, legCorrect);
    });

    const marathonCorrect = quizData.filter(q => parseFloat(q.userAnswer) == q.correct).length;
    recordMarathonHistoryEntry(currentDifficulty, quizData.length, marathonCorrect);
  } else {
    const correct = quizData.filter(q => parseFloat(q.userAnswer) == q.correct).length;
    recordHistoryEntry(currentRubric, currentDifficulty, quizData.length, correct);
  }

  showResults();
}

// Below this many questions, a single mistake swings the percentage too far
// (e.g. 1/5 wrong = 80%) for a letter grade to mean anything, so we fall
// back to showing the plain fraction instead.
const MIN_QUESTIONS_FOR_LETTER_GRADE = 10;

function getLetterGrade(percent) {
  if (percent >= 97) return "A+";
  if (percent >= 93) return "A";
  if (percent >= 90) return "A-";
  if (percent >= 87) return "B+";
  if (percent >= 83) return "B";
  if (percent >= 80) return "B-";
  if (percent >= 77) return "C+";
  if (percent >= 73) return "C";
  if (percent >= 70) return "C-";
  if (percent >= 67) return "D+";
  if (percent >= 63) return "D";
  if (percent >= 60) return "D-";
  return "F";
}

function showResults() {
  clearInterval(timer);

  quizScreen.style.display = "none";
  resultsScreen.style.display = "block";

  const correct = quizData.filter(q => parseFloat(q.userAnswer) == q.correct).length;
  const total = quizData.length;

  const bigScore = document.getElementById("big-score");
  const scoreFraction = document.getElementById("score-fraction");

  if (total >= MIN_QUESTIONS_FOR_LETTER_GRADE) {
    bigScore.textContent = getLetterGrade((correct / total) * 100);
    scoreFraction.textContent = `${correct} / ${total}`;
  } else {
    bigScore.textContent = `${correct} / ${total}`;
    scoreFraction.textContent = "";
  }

  document.getElementById("time-elapsed").textContent = totalTimeSpent.toFixed(1);

  const stats = document.getElementById("question-stats");
  const showOnlyErrors = showOnlyErrorsChk.checked;
  stats.innerHTML = "";

  quizData.forEach((q, i) => {
    const div = document.createElement("div");
    let ua = q.userAnswer === "" ? "(blank)" : q.userAnswer;
    const isCorrect = parseFloat(q.userAnswer) == q.correct;

    if (showOnlyErrors && isCorrect) {
      return;
    }

    div.innerHTML = `
            <p><strong>Q${i+1}:</strong> ${q.question}
            <br>Answer:
                <span class="${isCorrect ? 'correct' : 'wrong'}">${ua}</span>
                ${!isCorrect ? ` → <strong>${q.correct}</strong>` : ""}
            <br><small>Time: ${q.timeSpent}s</small></p>
            <hr>
        `;
    stats.appendChild(div);
  });

  // 🎉 Fireworks for perfect score
  if (correct === quizData.length) {
    startFireworks();
  }
}

function stopFireworks() {
  if (fireworksAnimationId) {
    cancelAnimationFrame(fireworksAnimationId);
    fireworksAnimationId = null;
  }
  const canvas = document.getElementById("fireworks-canvas");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.display = "none";
}

function startFireworks() {
  stopFireworks();

  const canvas = document.getElementById("fireworks-canvas");
  const ctx = canvas.getContext("2d");
  canvas.style.display = "block";

  // Fullscreen canvas
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const fireworks = [];
  const particlesPerFirework = 60;
  const gravity = 0.05;

  function spawnFirework() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.5;
    const particles = [];

    for (let i = 0; i < particlesPerFirework; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1
      });
    }
    fireworks.push(particles);
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    fireworks.forEach((particles, i) => {
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.alpha -= 0.02;

        ctx.fillStyle = `rgba(255, 200, 50, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Remove finished fireworks
      if (particles.every(p => p.alpha <= 0)) {
        fireworks.splice(i, 1);
      }
    });

    // Spawn new fireworks randomly
    if (Math.random() < 0.05) spawnFirework();

    fireworksAnimationId = requestAnimationFrame(update);
  }

  spawnFirework();
  update();
}

// Recent attempts list ----------------------------------------------------
// Combines both history stores into one chronological feed. A marathon run
// contributes its 4 per-rubric quizHistory entries plus one overall
// marathonHistory entry, so a single marathon shows up as 5 rows here -
// that's intentional, since each leg is graded and worth seeing on its own.
const RECENT_ATTEMPTS_LIMIT = 20;
const attemptsTableBody = document.getElementById("attempts-table-body");

function formatAttemptResult(correct, total, grade) {
  if (grade) return `${grade} (${correct}/${total})`;
  if (total >= MIN_QUESTIONS_FOR_LETTER_GRADE) {
    return `${getLetterGrade((correct / total) * 100)} (${correct}/${total})`;
  }
  return `${correct}/${total}`;
}

function renderAttemptsHistory() {
  const quizAttempts = loadHistory().map(e => ({
    date: e.date,
    test: `${capitalize(e.rubric)} (${capitalize(e.difficulty)})`,
    result: formatAttemptResult(e.correct, e.total, null),
  }));

  const marathonAttempts = loadMarathonHistory().map(e => ({
    date: e.date,
    test: `Marathon (${capitalize(e.difficulty)})`,
    result: formatAttemptResult(e.correct, e.total, e.grade),
  }));

  const attempts = quizAttempts
    .concat(marathonAttempts)
    .sort((a, b) => b.date - a.date)
    .slice(0, RECENT_ATTEMPTS_LIMIT);

  attemptsTableBody.innerHTML = "";

  if (attempts.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" style="text-align:center; color:#999;">No attempts yet</td>`;
    attemptsTableBody.appendChild(row);
    return;
  }

  attempts.forEach(a => {
    const d = new Date(a.date);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${d.toLocaleDateString()}</td>
      <td>${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
      <td>${a.test}</td>
      <td>${a.result}</td>
    `;
    attemptsTableBody.appendChild(row);
  });
}

renderAttemptsHistory();

// Generate tab ----------------------------------------------------------------
// A user-built formula (a sequence of number-size and operation tags,
// alternating and starting/ending on a number tag) generates a worksheet of
// examples all shown at once, checked together rather than one at a time.
const TAG_DEFS = {
  digit1: { type: "number", min: 2, max: 9, label: "1-digit" },
  digit2: { type: "number", min: 10, max: 99, label: "2-digit" },
  digit3: { type: "number", min: 100, max: 999, label: "3-digit" },
  digit4: { type: "number", min: 1000, max: 9999, label: "4-digit" },
  addition: { type: "op", symbol: "+", label: "Addition" },
  subtraction: { type: "op", symbol: "-", label: "Subtraction" },
  multiplication: { type: "op", symbol: "×", label: "Multiplication" },
  division: { type: "op", symbol: "÷", label: "Division" },
};

let genSets = [{ formula: [], count: 10 }];
let genQuestions = [];

function buildFormulaParts(formula) {
  const numberTags = [];
  const ops = [];
  formula.forEach(tag => {
    if (TAG_DEFS[tag].type === "number") numberTags.push(tag);
    else ops.push(tag);
  });
  return { numberTags, ops };
}

function isValidFormula(formula) {
  if (formula.length === 0) return false;
  for (let i = 0; i < formula.length; i++) {
    const def = TAG_DEFS[formula[i]];
    if (!def) return false;
    if (def.type !== (i % 2 === 0 ? "number" : "op")) return false;
  }
  return formula.length % 2 === 1;
}

// For subtraction/division, the running total up to this point must be able
// to reach at least the next tag's minimum - otherwise every example would
// need a negative subtraction or a fractional division no matter what gets
// generated. Tracks the best/worst-case running total through the formula
// to catch a formula like "2-digit - 3-digit" before generation ever starts.
function findFormulaRangeError(formula) {
  const { numberTags, ops } = buildFormulaParts(formula);
  let lo = TAG_DEFS[numberTags[0]].min;
  let hi = TAG_DEFS[numberTags[0]].max;

  for (let k = 0; k < ops.length; k++) {
    const tag = numberTags[k + 1];
    const tagDef = TAG_DEFS[tag];

    if (ops[k] === "subtraction" && hi < tagDef.min) {
      return `${TAG_DEFS[numberTags[k]].label} can never be large enough to subtract ${tagDef.label} - swap the order or pick a smaller tag.`;
    }
    // A divisor equal to the dividend (quotient of 1) is excluded, so the
    // running total must be able to reach at least twice the divisor's
    // minimum - otherwise the only "exact" divisor left is itself.
    if (ops[k] === "division" && hi < 2 * tagDef.min) {
      return `${TAG_DEFS[numberTags[k]].label} can never be large enough to divide by ${tagDef.label} without the result just dividing into itself - swap the order or pick a smaller tag.`;
    }
    if (ops[k] === "addition") {
      lo += tagDef.min;
      hi += tagDef.max;
    } else if (ops[k] === "subtraction") {
      lo = Math.max(0, lo - tagDef.max);
      hi = Math.max(0, hi - tagDef.min);
    } else if (ops[k] === "multiplication") {
      lo *= tagDef.min;
      hi *= tagDef.max;
    } else if (ops[k] === "division") {
      lo = Math.floor(lo / tagDef.max);
      hi = Math.floor(hi / tagDef.min);
    }
  }
  return null;
}

// Picks a random "number, operation, number" formula, re-rolling until it
// passes findFormulaRangeError - so the Random button never lands on a
// formula that's a priori impossible (e.g. "2-digit - 3-digit").
const NUMBER_TAG_KEYS = Object.keys(TAG_DEFS).filter(k => TAG_DEFS[k].type === "number");
const OP_TAG_KEYS = Object.keys(TAG_DEFS).filter(k => TAG_DEFS[k].type === "op");

// Random-generated multiplication is kept to the largest pairing still easy
// to work out by hand: a 1-digit number times a 2-digit number (9×99). This
// only constrains the Random button - a formula built by hand can multiply
// whatever tags the user picks.
const MAX_MULTIPLICATION_PRODUCT = TAG_DEFS.digit1.max * TAG_DEFS.digit2.max;

function isRandomMultiplicationTooLarge(formula) {
  return formula[1] === "multiplication" &&
    TAG_DEFS[formula[0]].max * TAG_DEFS[formula[2]].max > MAX_MULTIPLICATION_PRODUCT;
}

function randomValidFormula() {
  let formula;
  let attempts = 0;
  do {
    formula = [
      NUMBER_TAG_KEYS[rand(0, NUMBER_TAG_KEYS.length - 1)],
      OP_TAG_KEYS[rand(0, OP_TAG_KEYS.length - 1)],
      NUMBER_TAG_KEYS[rand(0, NUMBER_TAG_KEYS.length - 1)],
    ];
    attempts++;
  } while ((findFormulaRangeError(formula) || isRandomMultiplicationTooLarge(formula)) && attempts < 100);
  return formula;
}

// Returns a random divisor of n within [min, max] (excluding `exclude`, so a
// number is never shown dividing itself into a trivial quotient of 1), or
// null if none exists.
function findDivisorOf(n, min, max, exclude) {
  const divisors = [];
  for (let d = min; d <= max; d++) {
    if (d !== exclude && n % d === 0) divisors.push(d);
  }
  return divisors.length ? divisors[rand(0, divisors.length - 1)] : null;
}

// Generates one example. Division works the simple way: the dividend (the
// running result so far) is already fixed, so the divisor is just re-rolled
// within its own digit range until the division comes out to a whole number
// and isn't the dividend itself (which would be a trivial "divides itself").
// Searched exhaustively rather than by blind random guesses, since a wide
// digit range (e.g. 4-digit ÷ 4-digit) can have very few valid divisors.
function generateOneExample(formula) {
  const { numberTags, ops } = buildFormulaParts(formula);
  const values = numberTags.map(tag => rand(TAG_DEFS[tag].min, TAG_DEFS[tag].max));
  let result = values[0];

  for (let k = 0; k < ops.length; k++) {
    const op = ops[k];
    const def = TAG_DEFS[numberTags[k + 1]];

    if (op === "addition") {
      result += values[k + 1];
    } else if (op === "subtraction") {
      // Generate the subtrahend already bounded by the running total,
      // instead of drawing it freely and fixing it up after the fact.
      const hi = Math.min(def.max, result);
      const lo = Math.min(def.min, hi);
      values[k + 1] = rand(lo, hi);
      result -= values[k + 1];
    } else if (op === "multiplication") {
      result *= values[k + 1];
    } else if (op === "division") {
      const min = Math.max(2, def.min);
      const max = def.max;
      const divisor = findDivisorOf(result, min, max, result);

      if (divisor !== null) {
        values[k + 1] = divisor;
        result = result / divisor;
      }
      // If nothing in the tag's own range divides evenly, leave `result`
      // as-is - it will no longer match a from-scratch recomputation, so
      // isExampleValid rejects this example and the caller retries with a
      // fresh dividend, rather than quietly using an undersized divisor.
    }
  }

  return { values, ops, result };
}

// The retroactive adjustments generateOneExample makes for division (e.g.
// rewriting an earlier operand so a later division comes out exact) can
// occasionally reintroduce a 0/1 operand or a number dividing into itself,
// especially with small digit-1 ranges. Rather than special-casing every
// arithmetic branch further, just reject and retry.
function isExampleValid(values, ops) {
  if (values.some(v => v === 0 || v === 1)) return false;
  let running = values[0];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k] === "division") {
      if (values[k + 1] === running) return false;
      running = running / values[k + 1];
      if (!Number.isInteger(running)) return false;
    } else if (ops[k] === "addition") {
      running += values[k + 1];
    } else if (ops[k] === "subtraction") {
      running -= values[k + 1];
    } else if (ops[k] === "multiplication") {
      running *= values[k + 1];
    }
    if (running < 0) return false;
  }
  return true;
}

function generateValidExample(formula) {
  let example = generateOneExample(formula);
  let attempts = 0;
  while (!isExampleValid(example.values, example.ops) && attempts < 300) {
    example = generateOneExample(formula);
    attempts++;
  }
  return example;
}

function formatEquationText(values, ops) {
  let text = String(values[0]);
  ops.forEach((op, i) => {
    text += ` ${TAG_DEFS[op].symbol} ${values[i + 1]}`;
  });
  return text + " =";
}

function generateFormulaQuestions(formula, count) {
  const list = [];
  let retries = 0;
  const maxRetries = 3;

  for (let i = 0; i < count; i++) {
    const { values, ops, result } = generateValidExample(formula);
    const text = formatEquationText(values, ops);

    if (list.length > 0 && list[list.length - 1].text === text && retries++ < maxRetries) {
      i--;
      continue;
    }
    retries = 0;

    list.push({ text, result });
  }

  return list;
}

const genSetsEl = document.getElementById("gen-sets");
const genAddSetBtn = document.getElementById("gen-add-set-btn");

function isSetFormulaValid(set) {
  return isValidFormula(set.formula) && !findFormulaRangeError(set.formula);
}

function updateAddSetButtonState() {
  genAddSetBtn.disabled = !isSetFormulaValid(genSets[genSets.length - 1]);
}

function renderGenFormulaChips(setIndex) {
  const formula = genSets[setIndex].formula;
  const el = genSetsEl.querySelector(`.gen-formula[data-set="${setIndex}"]`);

  el.innerHTML = formula.length === 0
    ? `<span class="gen-formula-empty">Add tags to build a formula…</span>`
    : formula.map((tag, i) => `
        <span class="gen-chip">${TAG_DEFS[tag].label}<button type="button" class="gen-chip-remove" data-idx="${i}">×</button></span>
      `).join("");
}

function renderGenSets() {
  genSetsEl.innerHTML = genSets.map((set, i) => `
    <div class="gen-set">
      <div class="gen-set-header">
        <span class="gen-set-label">${i + 1}</span>
        <input type="number" class="gen-count-input" data-set="${i}" min="1" max="50" value="${set.count}" placeholder="Count">
        <span class="gen-count-label">examples</span>
        ${genSets.length > 1 ? `<button type="button" class="gen-remove-set-btn" data-set="${i}" title="Remove set">×</button>` : ""}
      </div>

      <div class="gen-formula" data-set="${i}"></div>

      <div class="field">
        <label>Numbers</label>
        <div class="btn-group">
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="digit1">1-digit</button>
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="digit2">2-digit</button>
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="digit3">3-digit</button>
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="digit4">4-digit</button>
        </div>
      </div>

      <div class="field">
        <label>Operations</label>
        <div class="btn-group">
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="addition">Addition</button>
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="subtraction">Subtraction</button>
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="multiplication">Multiplication</button>
          <button type="button" class="option-btn tag-btn" data-set="${i}" data-tag="division">Division</button>
        </div>
      </div>

      <div class="gen-formula-actions">
        <button type="button" class="gen-clear-btn" data-set="${i}">Clear</button>
        <button type="button" class="gen-random-btn" data-set="${i}">Random</button>
      </div>
    </div>
  `).join("");

  genSets.forEach((set, i) => renderGenFormulaChips(i));

  genSetsEl.querySelectorAll(".gen-count-input").forEach(inp => {
    inp.addEventListener("input", () => {
      genSets[parseInt(inp.dataset.set)].count = parseInt(inp.value);
    });
  });

  genSetsEl.querySelectorAll(".tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const setIndex = parseInt(btn.dataset.set);
      genSets[setIndex].formula.push(btn.dataset.tag);
      renderGenFormulaChips(setIndex);
      updateAddSetButtonState();
    });
  });

  genSetsEl.querySelectorAll(".gen-formula").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.classList.contains("gen-chip-remove")) {
        const setIndex = parseInt(el.dataset.set);
        genSets[setIndex].formula.splice(parseInt(e.target.dataset.idx), 1);
        renderGenFormulaChips(setIndex);
        updateAddSetButtonState();
      }
    });
  });

  genSetsEl.querySelectorAll(".gen-clear-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const setIndex = parseInt(btn.dataset.set);
      genSets[setIndex].formula = [];
      renderGenFormulaChips(setIndex);
      updateAddSetButtonState();
    });
  });

  genSetsEl.querySelectorAll(".gen-random-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const setIndex = parseInt(btn.dataset.set);
      genSets[setIndex] = { formula: randomValidFormula(), count: rand(3, 20) };
      renderGenFormulaChips(setIndex);
      genSetsEl.querySelector(`.gen-count-input[data-set="${setIndex}"]`).value = genSets[setIndex].count;
      updateAddSetButtonState();
    });
  });

  genSetsEl.querySelectorAll(".gen-remove-set-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      genSets.splice(parseInt(btn.dataset.set), 1);
      renderGenSets();
    });
  });

  updateAddSetButtonState();
}

genAddSetBtn.addEventListener("click", () => {
  genSets.push({ formula: [], count: 10 });
  renderGenSets();
});

renderGenSets();

const genWorksheet = document.getElementById("gen-worksheet");
const genQuestionsEl = document.getElementById("gen-questions");
const genCheckBtn = document.getElementById("gen-check-btn");
const genScoreEl = document.getElementById("gen-score");
const genErrorEl = document.getElementById("gen-error");

function updateGenCheckButtonState() {
  const inputs = genQuestionsEl.querySelectorAll(".gen-answer-input");
  genCheckBtn.disabled = !Array.from(inputs).every(inp => inp.value.trim() !== "");
}

function renderGenWorksheet() {
  let lastSetIndex = null;

  genQuestionsEl.innerHTML = genQuestions.map((q, i) => {
    let divider = "";
    if (genSets.length > 1 && q.setIndex !== lastSetIndex) {
      divider = `<div class="gen-set-divider">Set ${q.setIndex + 1}</div>`;
      lastSetIndex = q.setIndex;
    }
    return `${divider}
    <div class="gen-question">
      <span class="gen-question-text">${q.text}</span>
      <input type="number" inputmode="numeric" class="gen-answer-input" data-index="${i}" autocomplete="off">
      <span class="gen-result-badge"></span>
    </div>`;
  }).join("");

  genQuestionsEl.querySelectorAll(".gen-answer-input").forEach(inp => {
    inp.addEventListener("input", updateGenCheckButtonState);
  });

  genWorksheet.style.display = "block";
  genScoreEl.style.display = "none";
  genCheckBtn.disabled = true;
}

document.getElementById("gen-generate-btn").addEventListener("click", () => {
  genErrorEl.style.display = "none";

  for (let i = 0; i < genSets.length; i++) {
    const set = genSets[i];
    const label = genSets.length > 1 ? `Set ${i + 1}: ` : "";

    if (!set.count || set.count < 1 || set.count > 50) {
      genErrorEl.textContent = `${label}Enter a number of examples between 1 and 50.`;
      genErrorEl.style.display = "block";
      genWorksheet.style.display = "none";
      return;
    }

    if (!isValidFormula(set.formula)) {
      genErrorEl.textContent = `${label}Build a formula starting and ending with a number tag, alternating with operations (e.g. 3-digit, Subtraction, 2-digit).`;
      genErrorEl.style.display = "block";
      genWorksheet.style.display = "none";
      return;
    }

    const rangeError = findFormulaRangeError(set.formula);
    if (rangeError) {
      genErrorEl.textContent = `${label}${rangeError}`;
      genErrorEl.style.display = "block";
      genWorksheet.style.display = "none";
      return;
    }
  }

  genQuestions = genSets.flatMap((set, setIndex) =>
    generateFormulaQuestions(set.formula, set.count).map(q => ({ ...q, setIndex }))
  );
  renderGenWorksheet();
});

// Plain SVG icons instead of the "✓"/"✕" glyphs, whose stroke weight varies
// unpredictably across fonts (and the "✕" grew a stray horizontal bar).
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
const CROSS_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';

genCheckBtn.addEventListener("click", () => {
  const rows = genQuestionsEl.querySelectorAll(".gen-question");
  let correctCount = 0;

  rows.forEach(row => {
    const inp = row.querySelector(".gen-answer-input");
    const textEl = row.querySelector(".gen-question-text");
    const badge = row.querySelector(".gen-result-badge");
    const q = genQuestions[parseInt(inp.dataset.index)];
    const isCorrect = parseFloat(inp.value.trim()) === q.result;

    // Reveal the correct answer in the same font as the question, right
    // after the "=" - the input itself is left exactly as the child typed
    // it, same place, same colors.
    textEl.textContent = `${q.text} ${q.result}`;
    inp.disabled = true;

    badge.classList.add(isCorrect ? "correct" : "wrong");
    badge.innerHTML = isCorrect ? CHECK_ICON : CROSS_ICON;

    if (isCorrect) correctCount++;
  });

  genScoreEl.textContent = `${correctCount} / ${rows.length}`;
  genScoreEl.style.display = "block";
  genCheckBtn.disabled = true;
});
