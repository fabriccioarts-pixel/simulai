import { hubData } from '../data/hubData.js';

export function renderSchedule(container) {
    if (!container) return;
    
    // Clear previous content
    container.innerHTML = '<div class="loader">Carregando cronograma...</div>';

    try {
        const scheduleContent = document.createElement('div');
        scheduleContent.className = 'schedule-view';
        
        // State management local to this view
        let currentDiscipline = 'Todas';
        let startDate = localStorage.getItem('schedule-start-date') || '';

        const disciplines = ['Todas', ...new Set(hubData.schedule.flatMap(w => w.days.map(d => d.discipline)))];

        const calculateProgress = () => {
            let total = 0;
            let done = 0;
            hubData.schedule.forEach(w => {
                w.days.forEach((d, i) => {
                    total++;
                    if (localStorage.getItem(`week-${w.week}-day-${i}`) === 'true') done++;
                });
            });
            return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
        };

        const renderUI = () => {
            const progress = calculateProgress();
            
            scheduleContent.innerHTML = `
                <div class="schedule-header-premium" style="margin-bottom:2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:1.5rem;">
                        <div>
                            <h2 style="font-size:1.75rem; margin-bottom:0.25rem;">Plano de Estudo Estratégico</h2>
                            <p style="color:var(--gray-400); font-size:0.9rem;">Cronograma Direcionado de 12 Semanas — Foco ESAF</p>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.8rem; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.1em;">Seu Progresso Total</span>
                            <div style="font-size:1.5rem; font-weight:700; color:var(--gray-100);">${progress.percent}% <span style="font-size:0.9rem; color:var(--gray-500); font-weight:400;">(${progress.done}/${progress.total} dias)</span></div>
                        </div>
                    </div>

                    <div class="progress-bar-main" style="width:100%; height:6px; background:var(--gray-800); margin-bottom:2rem; overflow:hidden;">
                        <div style="width:${progress.percent}%; height:100%; background:var(--gray-200); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>

                    <div class="schedule-toolbar" style="display:flex; flex-wrap:wrap; gap:1.5rem; padding:1.5rem; background:var(--gray-950); border:1px solid var(--border); align-items:center;">
                        <div style="flex:1; min-width:200px;">
                            <label style="display:block; font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; margin-bottom:0.5rem;">Filtrar Disciplina</label>
                            <select id="filter-discipline" style="width:100%; background:var(--gray-900); border:1px solid var(--gray-700); color:white; padding:0.6rem; font-family:inherit;">
                                ${disciplines.map(d => `<option value="${d}" ${currentDiscipline === d ? 'selected' : ''}>${d}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex:1; min-width:200px;">
                            <label style="display:block; font-size:0.75rem; color:var(--gray-500); text-transform:uppercase; margin-bottom:0.5rem;">Data de Início</label>
                            <input type="date" id="start-date-input" value="${startDate}" style="width:100%; background:var(--gray-900); border:1px solid var(--gray-700); color:white; padding:0.6rem; font-family:inherit;">
                        </div>
                        <div style="display:flex; gap:0.5rem; align-self:flex-end;">
                            <button id="reset-all-btn" class="btn-secondary" style="border-color:transparent; color:var(--gray-500);"><i data-lucide="rotate-ccw" style="width:16px;"></i> Resetar Tudo</button>
                        </div>
                    </div>
                </div>

                <div class="week-grid">
                    ${hubData.schedule.map(weekData => {
                        const filteredDays = weekData.days.filter(d => currentDiscipline === 'Todas' || d.discipline === currentDiscipline);
                        if (filteredDays.length === 0) return '';
                        
                        return `
                            <div class="day-card" style="animation: fade-in 0.3s ease-out;">
                                <h3>Semana ${weekData.week} <span class="day-label">${weekData.days.length} dias</span></h3>
                                <div class="days-list">
                                    ${weekData.days.map((day, index) => {
                                        if (currentDiscipline !== 'Todas' && day.discipline !== currentDiscipline) return '';
                                        
                                        const checkboxId = `week-${weekData.week}-day-${index}`;
                                        const isChecked = localStorage.getItem(checkboxId) === 'true';
                                        
                                        let dateStr = '';
                                        if (startDate) {
                                            const start = new Date(startDate + 'T00:00:00'); // Ensure local time
                                            const offset = (parseInt(weekData.week) - 1) * 7 + index;
                                            start.setDate(start.getDate() + offset);
                                            dateStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                        }

                                        return `
                                            <div class="subject-item ${isChecked ? 'completed' : ''}" data-week="${weekData.week}" data-day-idx="${index}">
                                                <input type="checkbox" id="${checkboxId}" ${isChecked ? 'checked' : ''}>
                                                <div class="subject-content" style="flex:1;">
                                                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                                        <div class="subject-name" style="${isChecked ? 'text-decoration:line-through; color:var(--gray-500);' : ''}"><strong>${day.day}:</strong> ${day.discipline}</div>
                                                        ${dateStr ? `<span style="font-size:0.7rem; color:var(--gray-500); font-weight:600;">${dateStr}</span>` : ''}
                                                    </div>
                                                    <div class="subject-topic">${day.topic || 'Revisão Técnica'}</div>
                                                </div>
                                                <i data-lucide="chevron-right" style="width:16px; color:var(--gray-600);"></i>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <style>
                    .subject-item.completed { border-left-color: #2d6a4f !important; }
                    .subject-item.completed:hover { background: rgba(45, 106, 79, 0.05); }
                    @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                </style>
            `;

            // Toolbar Events (Scoped)
            const fDisp = scheduleContent.querySelector('#filter-discipline');
            if (fDisp) fDisp.addEventListener('change', (e) => {
                currentDiscipline = e.target.value;
                renderUI();
                if (window.lucide) lucide.createIcons();
            });

            const sDate = scheduleContent.querySelector('#start-date-input');
            if (sDate) sDate.addEventListener('change', (e) => {
                startDate = e.target.value;
                localStorage.setItem('schedule-start-date', startDate);
                renderUI();
                if (window.lucide) lucide.createIcons();
            });

            const rBtn = scheduleContent.querySelector('#reset-all-btn');
            if (rBtn) rBtn.addEventListener('click', () => {
                if(confirm('Tem certeza que deseja apagar todo o progresso do cronograma?')) {
                    Object.keys(localStorage).forEach(k => { if(k.startsWith('week-')) localStorage.removeItem(k); });
                    renderUI();
                    if (window.lucide) lucide.createIcons();
                }
            });

            // Item Events
            scheduleContent.querySelectorAll('.subject-item').forEach(item => {
                const wIdx = item.dataset.week;
                const dIdx = item.dataset.dayIdx;
                const cbId = `week-${wIdx}-day-${dIdx}`;
                const cb = item.querySelector('input');

                cb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    localStorage.setItem(cbId, cb.checked);
                    renderUI();
                    if (window.lucide) lucide.createIcons();
                });

                item.addEventListener('click', () => {
                    const weekObj = hubData.schedule.find(w => w.week == wIdx);
                    if (weekObj) openContentModal(weekObj.days[dIdx], renderUI);
                });
            });
        };

        renderUI();
        container.innerHTML = '';
        container.appendChild(scheduleContent);
        if (window.lucide) lucide.createIcons();

    } catch (err) {
        container.innerHTML = `<div class="error-box" style="padding:2rem; background:#3d1a1a; color:#fca5a5; border:1px solid #7a1c1c;">
            <h3>Erro ao carregar cronograma</h3>
            <p>${err.message}</p>
        </div>`;
        console.error(err);
    }
}

function openContentModal(day) {
    const modal = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <div class="content-header">
            <span class="discipline-tag">${day.discipline}</span>
            <h2>${day.topic || 'Tópico de Estudo'}</h2>
        </div>
        
        <div class="content-body">
            <section class="strategic-summary">
                <h3><i data-lucide="book-open"></i> Resumo Estratégico</h3>
                <ul>
                    <li><strong>Conceito Fundamental:</strong> ${day.activity}</li>
                    <li>Foco na memorização de prazos e competências específicas citadas na legislação.</li>
                    <li>Relacionar este tema com os princípios fundamentais da Administração Pública (LIMPE).</li>
                </ul>
            </section>
            
            <section class="esaf-trap">
                <h3><i data-lucide="alert-triangle"></i> Principais Pegadinhas (ESAF)</h3>
                <p>A banca costuma trocar os termos <strong>"imprescritível"</strong> por <strong>"insuscetível de graça"</strong> ou inverter competências entre órgãos.</p>
                <div class="trap-quote">
                    "Fique atento à literalidade: a ESAF raramente aceita interpretações doutrinárias que divirjam do texto seco da lei."
                </div>
            </section>

            <section class="mini-exercise">
                <h3><i data-lucide="pencil-line"></i> Mini-exercício de Fixação</h3>
                <div class="exercise-box">
                    <p class="q-text">1. Segundo o padrão ESAF, sobre este tema, é correto afirmar que:</p>
                    <div class="options">
                        <p>a) O prazo para conclusão é de 30 dias, prorrogáveis.</p>
                        <p>b) Não admite hipótese de interrupção ou suspensão.</p>
                    </div>
                    <p class="gabarito-tip">(Gabarito: A — Ver literalidade da norma local)</p>
                </div>
            </section>

            <div class="resolution-tips" style="margin-bottom:2rem;">
                <h4><i data-lucide="lightbulb"></i> Dica do Professor</h4>
                <p>Revise este ponto 24h após o estudo inicial. Estatisticamente, a ESAF repete padrões de redação a cada 3 concursos similares.</p>
            </div>

            <div style="display:flex; gap:1rem; border-top:1px solid var(--border); padding-top:1.5rem;">
                <button id="modal-done-btn" class="btn-primary" style="flex:1; background:#2d6a4f; border-color:#2d6a4f; padding:1rem;">
                    <i data-lucide="check-circle"></i> Concluir Estudo de Hoje
                </button>
            </div>
        </div>
    `;


    modal.classList.remove('hidden');
    lucide.createIcons();

    document.getElementById('close-modal').onclick = () => {
        modal.classList.add('hidden');
    };

    document.getElementById('modal-done-btn').onclick = () => {
        // Find the checkbox and trigger it
        const week = hubData.schedule.findIndex(w => w.days.includes(day)) + 1;
        const dayIdx = hubData.schedule[week-1].days.indexOf(day);
        localStorage.setItem(`week-${week}-day-${dayIdx}`, 'true');
        
        // Refresh the underlying view
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = ''; // Clear to re-render
        renderSchedule(mainContent);

        modal.classList.add('hidden');
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.classList.add('hidden');
        }
    };
}
