let quizData = [];
let currentIndex = 0;
let perQuestionTime = 10;
let timer = null;
let timeLeft = 0;
let totalTimeSpent = 0;

// Elements
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultsScreen = document.getElementById("results-screen");

const rubricName = document.getElementById("rubric-name");
const questionNumber = document.getElementById("question-number");
const progressFill = document.getElementById("progress-bar-fill");
const problemStatement = document.getElementById("problem-statement");
const answerInput = document.getElementById("answer");

document.getElementById("start-btn").onclick = startQuiz;
document.getElementById("next-btn").onclick = nextQuestion;
document.getElementById("quit-btn").onclick = showResults;
document.getElementById("back-btn").onclick = () => {
    clearInterval(timer);
    quizScreen.style.display = "none";
    startScreen.style.display = "block";
};

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

    quizData = generateQuestions(rubric, difficulty, numQ);
    currentIndex = 0;

    startScreen.style.display = "none";
    quizScreen.style.display = "block";

    rubricName.textContent = rubric.charAt(0).toUpperCase() + rubric.slice(1);

    loadQuestion();
}

function generateQuestions(rubric, difficulty, count) {
    const min = difficulty === "easy" ? 1 : difficulty === "medium" ? 5 : 10;
    const max = difficulty === "easy" ? 10 : difficulty === "medium" ? 25 : 50;

    const list = [];

    for (let i = 0; i < count; i++) {
        let a = rand(min, max);
        let b = rand(min, max);

        let q = {}, text = "", ans = 0;

        switch (rubric) {
            case "addition":
                text = `${a} + ${b} =`;
                ans = a + b;
                break;
            case "subtraction":
                if (a < b) {
                  let t = a;
                  a = b;
                  b = t;
                }
                text = `${a} - ${b} =`;
                ans = a - b;
                break;
            case "multiplication":
                a = rand(3, 4);
                b = rand(2, 11);
                text = `${a} × ${b} =`;
                ans = a * b;
                break;
            case "division":
                ans = rand(1, 10);
                b = rand(2, 2);
                // if (Math.random() > 0.5) {
                //   let t = ans;
                //   ans = b;
                //   b = t;
                // }

                a = ans * b;
                text = `${a} ÷ ${b} =`;
                break;
        }

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
        showResults();
    } else {
        loadQuestion();
    }
}

function showResults() {
    clearInterval(timer);

    quizScreen.style.display = "none";
    resultsScreen.style.display = "block";

    const correct = quizData.filter(q => parseFloat(q.userAnswer) == q.correct).length;

    // New playful score display
    const bigScore = document.getElementById("big-score");
    bigScore.textContent = `${correct} / ${quizData.length}`;

    document.getElementById("time-elapsed").textContent = totalTimeSpent.toFixed(1);

    const stats = document.getElementById("question-stats");
    stats.innerHTML = "";

    quizData.forEach((q, i) => {
        const div = document.createElement("div");
        let ua = q.userAnswer === "" ? "(blank)" : q.userAnswer;
        const isCorrect = parseFloat(q.userAnswer) == q.correct;

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

function startFireworks() {
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
                x, y,
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

        requestAnimationFrame(update);
    }

    spawnFirework();
    update();
}
