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
            body: JSON.stringify({ quizId })
        });
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

            <div class="quiz-controls" style="justify-content: flex-end;">
                <div class="quiz-controls-right">
                    <button id="check-btn" class="btn-primary" disabled>Ver Resposta</button>
                    <button id="next-btn" class="btn-accent hidden">Próxima <i data-lucide="arrow-right"></i></button>
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
            if (checkBtn.classList.contains('hidden')) return; // Already checked
            optionBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedLetter = btn.dataset.letter;
            checkBtn.disabled = false;
        });
    });

    checkBtn.addEventListener('click', async () => {
        const payload = {
            sessionId: quizSessionId,
            questionId: currentQ.id,
            selectedLetter
        };

        checkBtn.innerText = "Processando...";
        checkBtn.disabled = true;

        try {
            const res = await apiFetch('/api/quiz/answer', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.error === 'PAYWALL') {
                showPaywall(container);
                return;
            }

            if (!json.success) throw new Error(json.error);

            // Highlight Correct / Wrong
            optionBtns.forEach(btn => {
                if (btn.dataset.letter === json.correctLetter) btn.classList.add('correct');
                else if (btn.dataset.letter === selectedLetter) btn.classList.add('wrong');
                btn.disabled = true;
            });

            document.getElementById('correct-letter').textContent = json.correctLetter;
            document.getElementById('explanation-text').innerHTML = renderMarkdown(json.explanation) + (json.pegadinha ? `<br><br><strong>⚠️ Pegadinha:</strong> ${json.pegadinha}` : '');
            explanationBox.classList.remove('hidden');

            checkBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');

            // Store state for next render
            currentQIdx = json.currentQuestionIndex;
            currentScore = json.score;
            currentQ = json.nextQuestion;

        } catch(e) {
            window.showAlert('Erro', 'Houve um problema ao processar sua resposta.', 'error');
            checkBtn.innerText = "Ver Resposta";
            checkBtn.disabled = false;
        }
    });

    nextBtn.addEventListener('click', () => {
        renderQuestionUI(container);
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

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);

    const percentage = data.percentage || 0;
    let classification = '';
    if (percentage > 80)       classification = 'Aprovado';
    else if (percentage >= 70) classification = 'Competitivo';
    else                       classification = 'Reprovado';

    container.innerHTML = `
        <div class="result-screen" style="animation: fade-in 0.4s ease-out;">
            <h2>Resultado Final</h2>
            <div class="result-stats">
                <div class="stat">
                    <p>Acertos</p>
                    <p>${data.score}/${data.total}</p>
                </div>
                <div class="stat">
                    <p>Percentual</p>
                    <p>${percentage}%</p>
                </div>
                <div class="stat">
                    <p>Tempo na Sessão</p>
                    <p>${h}h ${m}m</p>
                </div>
            </div>
            <div class="result-classification">${classification}</div>
            <button id="restart-btn" class="btn-primary" style="margin-top:1.5rem;">Voltar Início</button>
        </div>
    `;

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
