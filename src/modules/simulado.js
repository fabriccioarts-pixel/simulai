import { hubData } from '../data/hubData.js';

let currentQuestionIndex = 0;
let userAnswers = [];
let timerInterval;
let startTime;

export async function renderSimulado(container) {
    const quizContent = document.createElement('div');
    quizContent.className = 'quiz-container';
    container.appendChild(quizContent);

    // Sync database count only if not already loaded to speed up rendering
    if (!hubData.quiz || hubData.quiz.length === 0) {
        // Initial loading state only shown when fetching
        quizContent.innerHTML = '<div class="loader">Sincronizando Banco de Dados...</div>';
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/questoes`);
            const json = await res.json();
            if (json.success && json.data) {
                hubData.quiz = json.data.map(q => ({
                    id: parseInt(q.original_id) || q.id,
                    disciplina: q.discipline,
                    enunciado: q.question,
                    alternativas: JSON.parse(q.options),
                    explicacao: q.explanation,
                    banca: q.banca || "ESAF",
                    pegadinha_esaf: q.pegadinha || ""
                }));
            }
        } catch(e) { 
            console.warn("Using local fallback data", e); 
        }
    }

    const totalQuestions = hubData.quiz.length;

    quizContent.innerHTML = `
        <div class="start-screen">
            <h2>Simulado Completo ATA</h2>
            <p>${totalQuestions} Questões | Peso 2 (Prova 2) | Estilo ESAF<br>
            <strong>Sugestão: 3.5 minutos por questão</strong></p>
            <button id="start-btn" class="btn-accent">INICIAR SIMULADO</button>
        </div>
    `;

    document.getElementById('start-btn').addEventListener('click', () => {
        startQuiz(quizContent);
    });
}

async function startQuiz(container) {
    currentQuestionIndex = 0;
    userAnswers = [];
    startTime = Date.now();

    if (window.setQuizMode) window.setQuizMode(true);

    timerInterval = setInterval(() => { updateTimer(); }, 1000);
    renderQuestion(container);
}

function updateTimer() {
    const timerEl = document.getElementById('quiz-timer');
    if (!timerEl) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${h}:${m}:${s}`;
}

function renderMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^---$/gm, '<hr style="margin:1.5rem 0;border:none;border-top:1px solid var(--border);">')
        .replace(/\n/g, '<br>');
}

function renderQuestion(container) {
    const q = hubData.quiz[currentQuestionIndex];
    if (!q) { finishQuiz(container); return; }

    const total = hubData.quiz.length;
    const progress = ((currentQuestionIndex + 1) / total) * 100;

    container.innerHTML = `
        <div class="simu-header">
            <div class="simu-info">
                <span class="q-count">Questao <strong>${currentQuestionIndex + 1}</strong> de ${total}</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
            </div>
            <div class="timer-container" id="quiz-timer">00:00:00</div>
        </div>

        <div class="question-card">
            <div class="question-text">${renderMarkdown(q.enunciado)}</div>

            <div class="options-list">
                ${q.alternativas.map(opt => `
                    <button class="option-btn" data-letter="${opt.letra}">
                        <span class="opt-letter">${opt.letra}</span>
                        <span class="opt-text">${opt.texto}</span>
                    </button>
                `).join('')}
            </div>

            <div id="explanation-box" class="explanation-box hidden">
                <h4>Gabarito: <span id="correct-letter"></span></h4>
                <p id="explanation-text"></p>
            </div>

            <div class="quiz-controls">
                <button id="prev-btn" class="btn-secondary" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                    <i data-lucide="arrow-left"></i> Voltar
                </button>
                <div class="quiz-controls-right">
                    <button id="check-btn" class="btn-primary" disabled>Ver Resposta</button>
                    <button id="next-btn" class="btn-accent" disabled>Proxima <i data-lucide="arrow-right"></i></button>
                </div>
            </div>
        </div>
    `;

    const optionBtns = container.querySelectorAll('.option-btn');
    const checkBtn = document.getElementById('check-btn');
    const prevBtn  = document.getElementById('prev-btn');
    const nextBtn  = document.getElementById('next-btn');
    const explanationBox = document.getElementById('explanation-box');

    let selectedLetter = null;

    const existingAnswer = userAnswers.find(a => a.id === q.id);
    const correctOption = q.alternativas.find(o => o.correta);
    const correctLetter = correctOption ? correctOption.letra : '';

    if (existingAnswer) {
        selectedLetter = existingAnswer.selected;
        optionBtns.forEach(btn => {
            if (btn.dataset.letter === correctLetter) btn.classList.add('correct');
            if (btn.dataset.letter === selectedLetter) {
                btn.classList.add('selected');
                if (selectedLetter !== correctLetter) btn.classList.add('wrong');
            }
            btn.disabled = true;
        });
        document.getElementById('correct-letter').textContent = correctLetter;
        document.getElementById('explanation-text').innerHTML = renderMarkdown(q.explicacao) + (q.pegadinha_esaf ? `<br><br><strong>⚠️ Pegadinha ESAF:</strong> ${q.pegadinha_esaf}` : '');
        explanationBox.classList.remove('hidden');
        checkBtn.disabled = true;
        nextBtn.disabled = false;
    }

    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (existingAnswer) return;
            optionBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedLetter = btn.dataset.letter;
            checkBtn.disabled = false;
            nextBtn.disabled = false;
        });
    });

    checkBtn.addEventListener('click', () => {
        document.getElementById('correct-letter').textContent = correctLetter;
        document.getElementById('explanation-text').innerHTML = renderMarkdown(q.explicacao) + (q.pegadinha_esaf ? `<br><br><strong>⚠️ Pegadinha ESAF:</strong> ${q.pegadinha_esaf}` : '');
        explanationBox.classList.remove('hidden');
        optionBtns.forEach(btn => {
            if (btn.dataset.letter === correctLetter) btn.classList.add('correct');
            else if (btn.dataset.letter === selectedLetter) btn.classList.add('wrong');
            btn.disabled = true;
        });
        checkBtn.disabled = true;
        nextBtn.disabled = false;
        const idx = userAnswers.findIndex(a => a.id === q.id);
        if (idx === -1) userAnswers.push({ id: q.id, selected: selectedLetter, correct: correctLetter });
    });

    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) { currentQuestionIndex--; renderQuestion(container); }
    });

    nextBtn.addEventListener('click', () => {
        const idx = userAnswers.findIndex(a => a.id === q.id);
        if (idx === -1 && selectedLetter) {
            userAnswers.push({ id: q.id, selected: selectedLetter, correct: correctLetter });
        }
        currentQuestionIndex++;
        renderQuestion(container);
    });

    if (window.lucide) lucide.createIcons();
}

function finishQuiz(container) {
    clearInterval(timerInterval);
    if (window.setQuizMode) window.setQuizMode(false);

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const correctCount = userAnswers.filter(a => a.selected === a.correct).length;
    const percentage = Math.round((correctCount / hubData.quiz.length) * 100);

    let classification = '';
    if (percentage > 80)       classification = 'Aprovado';
    else if (percentage >= 70) classification = 'Competitivo';
    else                       classification = 'Reprovado';

    const themeStatsMap = {};
    hubData.quiz.forEach(q => {
        if (!themeStatsMap[q.disciplina]) themeStatsMap[q.disciplina] = { name: q.disciplina, total: 0, correct: 0 };
        themeStatsMap[q.disciplina].total++;
    });

    userAnswers.forEach(a => {
        if (a.selected === a.correct) {
            const q = hubData.quiz.find(x => x.id === a.id);
            if (q && themeStatsMap[q.disciplina]) {
                themeStatsMap[q.disciplina].correct++;
            }
        }
    });

    const themeStats = Object.values(themeStatsMap).map(t => ({
        ...t,
        percent: Math.round((t.correct / t.total) * 100) || 0
    }));

    container.innerHTML = `
        <div class="result-screen">
            <h2>Resultado Final</h2>
            <div class="result-stats">
                <div class="stat">
                    <p>Acertos</p>
                    <p>${correctCount}/${hubData.quiz.length}</p>
                </div>
                <div class="stat">
                    <p>Percentual</p>
                    <p>${percentage}%</p>
                </div>
                <div class="stat">
                    <p>Tempo</p>
                    <p>${h}h ${m}m</p>
                </div>
            </div>
            <div class="result-classification">${classification}</div>

            <div class="theme-report">
                <h3>Desempenho por Disciplina</h3>
                <div class="theme-grid">
                    ${themeStats.map(t => `
                        <div class="theme-card ${t.percent >= 70 ? 'good' : 'bad'}">
                            <div class="theme-header">
                                <span class="theme-name">${t.name}</span>
                                <span class="theme-score">${t.correct}/${t.total} (${t.percent}%)</span>
                            </div>
                            <div class="theme-bar-container">
                                <div class="theme-bar" style="width: ${t.percent}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="theme-feedback">
                    <div class="feedback-box positive">
                        <h4><i data-lucide="check-circle"></i> Mandou Bem (&ge; 70%)</h4>
                        <ul>
                            ${themeStats.filter(t => t.percent >= 70).length > 0 ? themeStats.filter(t => t.percent >= 70).map(t => `<li>${t.name} (<strong>${t.percent}%</strong>)</li>`).join('') : '<li>Nenhuma disciplina atingiu a meta.</li>'}
                        </ul>
                    </div>
                    <div class="feedback-box negative">
                        <h4><i data-lucide="alert-triangle"></i> Pontos de Atenção (&lt; 70%)</h4>
                        <ul>
                            ${themeStats.filter(t => t.percent < 70).length > 0 ? themeStats.filter(t => t.percent < 70).map(t => `<li>${t.name} (<strong>${t.percent}%</strong>)</li>`).join('') : '<li>Excelente! Todas as disciplinas na meta.</li>'}
                        </ul>
                    </div>
                </div>
            </div>

            <button id="restart-btn" class="btn-accent">
                <i data-lucide="rotate-ccw"></i> Refazer Simulado
            </button>
        </div>
    `;

    document.getElementById('restart-btn').addEventListener('click', () => {
        renderSimulado(container.parentElement);
    });

    if (window.lucide) lucide.createIcons();
}
