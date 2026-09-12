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
};

showOnlyErrorsChk.addEventListener("change", e => {
  showResults();
});

const SETTINGS_KEY = "quizSettings";

function saveSettings() {
  const settings = {
    rubric: document.getElementById("rubric").value,
    difficulty: document.getElementById("difficulty").value,
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

  const difficulty = difficultySelect.value;
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

difficultySelect.addEventListener("change", renderMarathonChart);

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
  const difficulty = document.getElementById("difficulty").value;
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
