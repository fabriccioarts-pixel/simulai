import { apiFetch } from '../config.js';

let quizSessionId = null;
let currentQIdx = 0;
let totalQs = 0;
let currentScore = 0;
let currentQ = null;
let timerInterval;
let startTime;

export async function renderSimulado(container) {
    container.innerHTML = ''; // Remove o loader que o main.js coloca antes de chamar esta função
    const quizContent = document.createElement('div');
    quizContent.className = 'quiz-container';
    container.appendChild(quizContent);

    let state = window.history.state || {};
    let params = new URLSearchParams(window.location.search);
    let quizId = state.quizId || params.get('quizId');

    quizContent.innerHTML = '<div class="loader">Carregando Simulado...</div>';

    if (!quizId) {
        try {
            const feedRes = await apiFetch('/api/quizzes');
            const feedJson = await feedRes.json();
            if (feedJson.success && feedJson.quizzes.length > 0) {
                quizId = feedJson.quizzes[0].id;
            } else {
                quizContent.innerHTML = '<div class="error-box">Nenhum simulado disponível.</div>';
                return;
            }
        } catch(e) {
            quizContent.innerHTML = '<div class="error-box">Erro ao conectar ao banco de dados D1.</div>';
            return;
        }
    }

    try {
        const res = await apiFetch(`/api/quiz/start`, {
            method: 'POST',
            body: JSON.stringify({ quizId, restart: window.isRestarting || false })
        });
        window.isRestarting = false;
        const json = await res.json();
        
        if (json.error === 'PAYWALL') {
             showPaywall(container);
             return;
        }

        if (json.success) {
            quizSessionId = json.sessionId;
            currentQIdx = json.currentQuestionIndex;
            totalQs = json.totalQuestions;
            currentScore = json.score;
            currentQ = json.currentQuestion;

            if (json.completed || !currentQ) {
                return fetchFinishAndRender(quizContent);
            }
        } else {
            quizContent.innerHTML = '<div class="error-box">Erro ao carregar sessão desse simulado.</div>';
            return;
        }
    } catch(e) {
        console.error(e);
        quizContent.innerHTML = '<div class="error-box">Erro HTTP ao iniciar simulado.</div>';
        return;
    }

    quizContent.innerHTML = `
        <div class="start-screen" style="animation: fade-in 0.3s ease-out;">
            <h2>Preparação do Simulado</h2>
            <p>${totalQs} Questões<br>
            <strong>Sugestão: 3 minutos por questão</strong></p>
            <button id="start-btn" class="btn-accent">INICIAR SIMULADO</button>
        </div>
    `;

    document.getElementById('start-btn').addEventListener('click', () => {
        startQuiz(quizContent);
    });
}

function startQuiz(container) {
    startTime = Date.now();
    if (window.setQuizMode) window.setQuizMode(true);
    timerInterval = setInterval(() => { updateTimer(); }, 1000);
    renderQuestionUI(container);
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

function renderQuestionUI(container) {
    if (!currentQ) { fetchFinishAndRender(container); return; }

    const progress = ((currentQIdx) / (totalQs || 1)) * 100;

    container.innerHTML = `
        <div class="simu-header">
            <div class="simu-info">
                <span class="q-count">Questão <strong>${currentQIdx + 1}</strong> de ${totalQs}</span>
                <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
            </div>
            <div class="timer-container" id="quiz-timer">00:00:00</div>
        </div>

        <div class="question-card slide-in-right">
            <div class="question-text">${renderMarkdown(currentQ.question)}</div>

            <div class="options-list">
                ${currentQ.options.map(opt => `
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

            <div class="quiz-controls" style="display:flex; justify-content:space-between; align-items:center; margin-top:2rem;">
                <div id="quiz-discrete-controls" class="hidden">
                    <button id="check-btn" class="btn-minimal" style="opacity:0.6; font-size:0.8rem; height:auto; padding:0.5rem 1rem;"><i data-lucide="eye" style="width:14px;"></i> Ver Gabarito (Opcional)</button>
                </div>
                <div class="quiz-controls-right" style="margin-left:auto;">
                    <button id="next-btn" class="btn-accent" disabled>Próxima <i data-lucide="arrow-right"></i></button>
                </div>
            </div>
        </div>
    `;

    const optionBtns = container.querySelectorAll('.option-btn');
    const checkBtn = document.getElementById('check-btn');
    const nextBtn  = document.getElementById('next-btn');
    const explanationBox = document.getElementById('explanation-box');

    let selectedLetter = null;

    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (nextBtn.dataset.answered === 'true') return;
            optionBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedLetter = btn.dataset.letter;
            nextBtn.disabled = false;
            document.getElementById('quiz-discrete-controls').classList.remove('hidden');
        });
    });

    const processAnswer = async () => {
        if (nextBtn.dataset.answered === 'true') return true;
        
        const payload = {
            sessionId: quizSessionId,
            questionId: currentQ.id,
            selectedLetter
        };

        try {
            const res = await apiFetch('/api/quiz/answer', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.error === 'PAYWALL') {
                showPaywall(container);
                return false;
            }

            if (!json.success) throw new Error(json.error);

            // Store state for next render
            currentQIdx = json.currentQuestionIndex;
            currentScore = json.score;
            currentQ = json.nextQuestion;
            
            // Mark as answered
            nextBtn.dataset.answered = 'true';
            nextBtn.dataset.correctLetter = json.correctLetter;
            nextBtn.dataset.explanation = json.explanation;
            nextBtn.dataset.pegadinha = json.pegadinha || '';
            
            return true;
        } catch(e) {
            window.showAlert('Erro', e.message || 'Houve um problema ao processar sua resposta.', 'error');
            return false;
        }
    };

    checkBtn.addEventListener('click', async () => {
        const ok = await processAnswer();
        if (!ok) return;

        const correctLetter = nextBtn.dataset.correctLetter;
        optionBtns.forEach(btn => {
            if (btn.dataset.letter === correctLetter) btn.classList.add('correct');
            else if (btn.dataset.letter === selectedLetter) btn.classList.add('wrong');
            btn.disabled = true;
        });

        document.getElementById('correct-letter').textContent = correctLetter;
        document.getElementById('explanation-text').innerHTML = renderMarkdown(nextBtn.dataset.explanation) + (nextBtn.dataset.pegadinha ? `<br><br><strong>⚠️ Pegadinha:</strong> ${nextBtn.dataset.pegadinha}` : '');
        explanationBox.classList.remove('hidden');
        checkBtn.classList.add('hidden');
    });

    nextBtn.addEventListener('click', async () => {
        const ok = await processAnswer();
        if (ok) renderQuestionUI(container);
    });

    if (window.lucide) lucide.createIcons();
}

async function fetchFinishAndRender(container) {
    const quizContent = container;
    quizContent.innerHTML = '<div class="loader">Calculando Resultado...</div>';
    
    try {
        const res = await apiFetch('/api/quiz/finish', {
            method: 'POST',
            body: JSON.stringify({ sessionId: quizSessionId })
        });
        const json = await res.json();
        if (json.success) {
            finishQuiz(quizContent, json);
        }
    } catch(e) {}
}

function finishQuiz(container, data) {
    clearInterval(timerInterval);
    if (window.setQuizMode) window.setQuizMode(false);

    const elapsed = (startTime && typeof startTime === 'number') ? (Date.now() - startTime) : 0;
    const totalMinutes = Math.floor(elapsed / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const percentage = data.percentage || 0;
    let classification = '';
    if (percentage > 80)       classification = 'Aprovado';
    else if (percentage >= 70) classification = 'Competitivo';
    else                       classification = 'Reprovado';

    container.innerHTML = `
        <div id="results-view" class="result-screen" style="animation: fade-in 0.4s ease-out;">
            <div class="results-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:3.5rem 2rem; text-align:center; box-shadow:0 15px 40px rgba(0,0,0,0.5); width:100%; max-width:600px; animation: scale-up 0.4s ease-out;">
                <h2 style="font-size:2rem; margin-bottom:2.5rem; letter-spacing:-0.02em;">Resultado Final</h2>
                
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1.5rem; margin-bottom:3rem;">
                    <div>
                        <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; margin-bottom:0.5rem; letter-spacing:0.05em;">Acertos</div>
                        <div style="font-size:2.2rem; font-weight:900; color:white;">${data.score}/${data.total}</div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; margin-bottom:0.5rem; letter-spacing:0.05em;">Percentual</div>
                        <div style="font-size:2.2rem; font-weight:900; color:white;">${percentage}%</div>
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; margin-bottom:0.5rem; letter-spacing:0.05em;">Tempo na Sessão</div>
                        <div style="font-size:1.8rem; font-weight:900; color:white;">${h}h ${m}m</div>
                    </div>
                </div>
                <div class="result-classification">${classification}</div>
                <div style="display:flex; gap:1rem; justify-content:center; margin-top:2rem;">
                    <button id="retest-btn" class="btn-minimal" style="border:1px solid var(--border);"><i data-lucide="refresh-cw"></i> Refazer Simulado</button>
                    <button id="restart-btn" class="btn-primary">Voltar Início</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('retest-btn').addEventListener('click', () => {
        window.isRestarting = true;
        renderSimulado(container);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        window.location.reload();
    });

    if (window.lucide) lucide.createIcons();
}

function showPaywall(container) {
    clearInterval(timerInterval);
    if (window.setQuizMode) window.setQuizMode(false);

    container.innerHTML = `
        <div style="max-width:500px; margin: 4rem auto; padding:2.5rem; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; border-top:4px solid #ef4444; box-shadow: 0 20px 40px rgba(0,0,0,0.6); text-align:center; animation: fade-in 0.3s ease-out;">
            <div style="width:70px; height:70px; background:rgba(239, 68, 68, 0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem;">
                <i data-lucide="lock" style="color:#ef4444; width:36px; height:36px;"></i>
            </div>
            <h2 style="font-size:1.75rem; color:var(--gray-100); margin-bottom:1rem;">Cota Diária Atingida</h2>
            <p style="color:var(--gray-300); font-size:1rem; line-height:1.6; margin-bottom:2rem;">Você utilizou suas 10 respostas gratuitas de hoje. Para continuar explodindo sua pontuação agora mesmo, libere o <strong>Acesso Premium</strong> do Simulai.</p>
            
            <button id="pw-monthly" data-price="price_1QwXXX_MONTHLY" class="btn-primary" style="width:100%; justify-content:center; padding:1rem; font-size:1.05rem; font-weight:700; background:var(--gray-800); margin-bottom:1rem;">
                Assinar Mensal por R$ 37
            </button>
            <button id="pw-annual" data-price="price_1QwXXX_ANNUAL" class="btn-primary" style="width:100%; justify-content:center; padding:1rem; font-size:1.05rem; font-weight:700; background:#ef4444; border:none; margin-bottom:1rem;">
                <i data-lucide="zap"></i> Assinar Anual por R$ 370
            </button>
            
            <a href="#" id="pw-close" style="color:var(--gray-500); font-size:0.9rem; text-decoration:underline;">Voltar para Meus Simulados</a>
        </div>
    `;

    document.getElementById('pw-close').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.reload();
    });

    const bindStripe = (id) => {
        document.getElementById(id).addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.innerHTML = "Redirecionando...";
            btn.disabled = true;
            try {
                const res = await apiFetch(`/payment/create-checkout-session`, {
                    method: "POST",
                    body: JSON.stringify({ 
                        priceId: btn.dataset.price,
                        origin: window.location.origin 
                    })
                });
                const session = await res.json();
                if (session.url) window.location.href = session.url;
                else window.showAlert("Erro", "Erro ao criar sessão de pagamento.", "error");
            } catch(err) {
                window.showAlert("Falha", err.message, "error");
                btn.innerHTML = "Tentar Novamente";
                btn.disabled = false;
            }
        });
    };

    bindStripe('pw-monthly');
    bindStripe('pw-annual');

    if (window.lucide) lucide.createIcons();
}
