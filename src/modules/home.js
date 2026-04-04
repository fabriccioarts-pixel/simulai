import { auth } from './auth.js';
import { apiFetch } from '../config.js';

export async function renderHome(container, navigateFn) {
    console.log("Home: Renderização iniciada.");
    
    let allQuizzes = [];
    const heroBg = "https://images.unsplash.com/photo-1454165833767-0274b24f2ed4?auto=format&fit=crop&q=80&w=1200";

    // 1. Renderiza o esqueleto IMEDIATAMENTE para não ficar vazio
    container.innerHTML = `
        <div id="home-feed-wrapper" style="width:100%; min-height:100vh;">
            <!-- HERO SECTION -->
            <div class="home-hero" style="position:relative; height:70vh; min-height:450px; background: linear-gradient(to top, var(--gray-900) 5%, transparent 50%), linear-gradient(to right, var(--gray-900) 30%, transparent 80%), url('${heroBg}') center/cover; display:flex; flex-direction:column; justify-content:center; padding: 0 4rem; margin-bottom: 2rem;">
                <div style="max-width:650px;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; color:#ef4444; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; font-size:0.8rem;">
                        <i data-lucide="award" style="width:16px;"></i> Simulação Exclusiva
                    </div>
                    <h1 id="hero-title" style="font-size:4rem; line-height:1; font-weight:900; margin-bottom:1.5rem; letter-spacing:-0.03em;">Prepare-se para a Elite</h1>
                    <p style="font-size:1.25rem; color:var(--gray-200); margin-bottom:2.5rem; line-height:1.5; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">
                        Acesse agora os simulados rotativos baseados no edital ATA/MF. Conteúdo atualizado dinamicamente.
                    </p>
                    <div style="display:flex; gap:1rem;">
                        <button id="hero-play-btn" class="btn-primary" style="background:#fff; color:#000; border:none; padding:1rem 2.5rem; font-size:1.2rem; font-weight:800; border-radius:4px; display:flex; align-items:center; gap:0.75rem;">
                            <i data-lucide="play" style="fill:currentColor; width:24px; height:24px;"></i> Começar Agora
                        </button>
                    </div>
                </div>
            </div>

            <!-- CONTENT AREA -->
            <div id="dynamic-content" class="netflix-content" style="padding: 0 4rem; position:relative; z-index:2; margin-top: -80px;">
                <section class="netflix-section">
                    <h3 class="netflix-row-title">Em Alta na Simulai</h3>
                    <div id="quizzes-row" class="netflix-row">
                        ${Array(6).fill(0).map(() => `
                            <div class="netflix-poster skeleton" style="min-height:220px;">
                                <div class="netflix-poster-thumb" style="background:transparent;"></div>
                                <div class="netflix-poster-info">
                                    <div class="skeleton-text" style="width:80%;"></div>
                                    <div class="skeleton-text" style="width:40%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <section class="netflix-section">
                    <h3 class="netflix-row-title">Conteúdos Especiais</h3>
                    <div class="netflix-row">
                        <div class="netflix-poster" onclick="window.open('/Apostila_ATA_Ministerio_Fazenda.pdf', '_blank')">
                            <div class="netflix-poster-thumb" style="background: linear-gradient(135deg, #1e3a8a, #1e40af);">
                                <i data-lucide="file-text" style="width:48px; height:48px; color:rgba(255,255,255,0.7);"></i>
                            </div>
                            <div class="netflix-poster-info"><div class="netflix-poster-title">Apostila Completa</div><div class="netflix-poster-meta">Guia PDF</div></div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Bind inicial do botão hero — navega para o simulado (usará o primeiro quiz disponível)
    const heroBtnInitial = document.getElementById('hero-play-btn');
    if (heroBtnInitial) {
        heroBtnInitial.onclick = () => navigateFn('simulado');
    }

    // 2. Busca simulados de forma assíncrona
    try {
        const res = await apiFetch('/api/quizzes');
        if (!res.ok) throw new Error("Erro na rede: " + res.status);
        const json = await res.json();
        
        if (json.success) {
            allQuizzes = json.quizzes || [];
            updateQuizzesRow(allQuizzes);
        } else {
            console.warn("Simulados não carregados (success: false):", json.error);
            document.getElementById('quizzes-row').innerHTML = `<p style="color:var(--gray-500);">Simulados indisponíveis no momento.</p>`;
        }
    } catch(e) {
        console.error("Erro no feed da home:", e);
        document.getElementById('quizzes-row').innerHTML = `<p style="color:var(--gray-500);">Erro ao carregar o feed. Tente atualizar a página.</p>`;
    }

    function updateQuizzesRow(quizzes) {
        const row = document.getElementById('quizzes-row');
        if (!row) return;

        if (quizzes.length === 0) {
            row.innerHTML = `<p style="color:var(--gray-500);">Nenhum simulado disponível.</p>`;
            return;
        }

        row.innerHTML = quizzes.map(q => {
            const isUnlocked = q.accessStatus === 'unlocked' || q.accessStatus === 'free_trial_available';
            const colors = { 'Direito': '#1e3a8a', 'Economia': '#065f46', 'Contabilidade': '#991b1b', 'Informática': '#3730a3', 'Default': '#1f2937' };
            const posterColor = colors[q.subject] || colors['Default'];

            return `
                <div class="netflix-poster" data-id="${q.id}" data-action="${isUnlocked ? 'simulado' : 'account'}">
                    <div class="netflix-poster-thumb" style="background-color: ${posterColor};">
                        <i data-lucide="${isUnlocked ? 'play-circle' : 'crown'}" style="width:40px; height:40px; color:rgba(255,255,255,0.7);"></i>
                        ${!isUnlocked ? '<div class="netflix-badge-premium">Premium</div>' : ''}
                    </div>
                    <div class="netflix-poster-info">
                        <div class="netflix-poster-title">${q.title}</div>
                        <div class="netflix-poster-meta"><span>${q.subject}</span></div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();

        // Re-bind botão hero com o ID do primeiro quiz disponível
        const heroBtn = document.getElementById('hero-play-btn');
        if (heroBtn && quizzes.length > 0) {
            const firstUnlocked = quizzes.find(q => q.accessStatus === 'unlocked' || q.accessStatus === 'free_trial_available');
            if (firstUnlocked) {
                heroBtn.onclick = () => {
                    window.history.pushState({ quizId: firstUnlocked.id }, '', '/');
                    navigateFn('simulado');
                };
            }
        }
        
        // Re-bind listeners dos posters
        row.querySelectorAll('.netflix-poster').forEach(poster => {
            poster.onclick = () => {
                const id = poster.dataset.id;
                if (poster.dataset.action === 'simulado') {
                    window.history.pushState({ quizId: id }, '', '/');
                    navigateFn('simulado');
                } else { navigateFn('account'); }
            };
        });
    }

    // Bind especial do cronograma
    const schedBtn = document.getElementById('spec-schedule');
    if (schedBtn) schedBtn.onclick = () => navigateFn('schedule');

    // Lógica de Busca Global
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
        searchInput.oninput = () => {
            const query = searchInput.value.toLowerCase();
            const row = document.getElementById('quizzes-row');
            const sections = document.querySelectorAll('.netflix-section');
            
            if (query.length > 0) {
                // Filtra e exibe resultados
                const filtered = allQuizzes.filter(q => 
                    q.title.toLowerCase().includes(query) || 
                    q.subject.toLowerCase().includes(query)
                );
                
                // Esconde seções originais e mostra apenas os resultados
                sections.forEach((s, idx) => { if(idx > 0) s.style.display = 'none'; });
                const mainRow = document.getElementById('quizzes-row');
                const mainTitle = document.querySelector('.netflix-row-title');
                
                if (mainTitle) mainTitle.innerHTML = `<i data-lucide="search" style="width:18px;"></i> Resultados para "${query}"`;
                
                if (filtered.length === 0) {
                    mainRow.innerHTML = `<div style="padding:3rem; color:var(--gray-500); text-align:center; width:100%;">Nenhum simulado encontrado com esse nome.</div>`;
                } else {
                    updateQuizzesRow(filtered);
                }
            } else {
                // Restaura estado original
                sections.forEach(s => s.style.display = 'block');
                const mainTitle = document.querySelector('.netflix-row-title');
                if (mainTitle) mainTitle.innerHTML = `Em Alta na Simulai`;
                updateQuizzesRow(allQuizzes);
            }
            if (window.lucide) lucide.createIcons();
        };
    }
}
