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
    if (e.key === "Enter") nextQuestion();
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
        const a = rand(min, max);
        const b = rand(min, max);

        let q = {}, text = "", ans = 0;

        switch (rubric) {
            case "addition":
                text = `${a} + ${b} =`;
                ans = a + b;
                break;
            case "subtraction":
                text = `${a} - ${b} =`;
                ans = a - b;
                break;
            case "multiplication":
                text = `${a} × ${b} =`;
                ans = a * b;
                break;
            case "division":
                text = `${a} ÷ ${b} =`;
                ans = (a / b);
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

    document.getElementById("correct-answers").textContent = correct;
    document.getElementById("total-questions").textContent = quizData.length;
    document.getElementById("time-elapsed").textContent = totalTimeSpent.toFixed(1);

    const stats = document.getElementById("question-stats");
    stats.innerHTML = "";

    quizData.forEach((q, i) => {
        const div = document.createElement("div");
        let ua = q.userAnswer === "" ? "(blank)" : q.userAnswer;
        const correct = parseFloat(q.userAnswer) == q.correct;

        div.innerHTML = `
            <p><strong>Q${i+1}:</strong> ${q.question}
            <br>Answer:
                <span class="${correct ? 'correct':'wrong'}">${ua}</span>
                ${!correct ? ` → <strong>${q.correct}</strong>` : ""}
            <br><small>Time: ${q.timeSpent}s</small></p>
            <hr>
        `;
        stats.appendChild(div);
    });
}
