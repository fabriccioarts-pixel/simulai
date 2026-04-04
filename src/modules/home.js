import { auth } from './auth.js';
import { apiFetch } from '../config.js';

export async function renderHome(container, navigateFn) {
    console.log("Home: Renderização iniciada com categorização dinâmica.");
    
    let allQuizzes = [];
    const heroBg = "https://images.unsplash.com/photo-1454165833767-0274b24f2ed4?auto=format&fit=crop&q=80&w=1200";

    // 1. Renderiza o esqueleto com containers para múltiplas fileiras
    container.innerHTML = `
        <div id="home-feed-wrapper" style="width:100%; min-height:100vh;">
            <div class="home-hero" style="position:relative; height:70vh; min-height:450px; background: linear-gradient(to top, var(--gray-900) 5%, transparent 50%), linear-gradient(to right, var(--gray-900) 30%, transparent 80%), url('${heroBg}') center/cover; display:flex; flex-direction:column; justify-content:center; padding: 0 4rem; margin-bottom: 2rem;">
                <div style="max-width:650px;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; color:#ef4444; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; font-size:0.8rem;">
                        <i data-lucide="zap" style="width:16px; fill:currentColor;"></i> Edital 2026 • ATA/MF
                    </div>
                    <h1 id="hero-title" style="font-size:4.5rem; line-height:0.95; font-weight:900; margin-bottom:1.5rem; letter-spacing:-0.04em;">A Sua Vaga é o Nosso Objetivo</h1>
                    <p style="font-size:1.3rem; color:var(--gray-300); margin-bottom:2.5rem; line-height:1.5; max-width:550px;">
                        Treine com simulados de alta performance, questões comentadas e revisão estratégica da banca ESAF.
                    </p>
                    <div style="display:flex; gap:1rem;">
                        <button id="hero-play-btn" class="btn-primary" style="background:#fff; color:#000; border:none; padding:1.2rem 3rem; font-size:1.2rem; font-weight:800; border-radius:8px; display:flex; align-items:center; gap:0.75rem; transition: transform 0.2s ease;">
                            <i data-lucide="play" style="fill:currentColor; width:24px; height:24px;"></i> Começar Simulado
                        </button>
                    </div>
                </div>
            </div>

            <div id="dynamic-content" class="netflix-content" style="padding: 0 4rem; position:relative; z-index:2; margin-top: -100px;">
                <!-- As fileiras serão injetadas aqui via JavaScript -->
                <div id="sections-container">
                    <div class="loader">Organizando seu plano de estudo...</div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    // 2. Busca e Processa Simulados
    try {
        const res = await apiFetch('/api/quizzes');
        const json = await res.json();
        
        if (json.success) {
            allQuizzes = json.quizzes || [];
            renderCategorizedFeed(allQuizzes);
        } else {
            document.getElementById('sections-container').innerHTML = `<p style="color:var(--gray-500);">Nenhum conteúdo disponível.</p>`;
        }
    } catch(e) {
        console.error("Erro no feed:", e);
    }

    function renderCategorizedFeed(quizzes) {
        const container = document.getElementById('sections-container');
        if (!container) return;
        container.innerHTML = '';

        // Agrupamento por Categorias (Simulados Recentes, e por Matéria)
        const categories = {
            'Em Alta na Simulai': quizzes.slice(0, 5), // Os primeiros 5
        };

        // Agrupar o restante por matéria
        quizzes.forEach(q => {
            const subject = q.subject || 'Geral';
            if (!categories[subject]) categories[subject] = [];
            categories[subject].push(q);
        });

        // Renderiza cada fileira
        Object.keys(categories).forEach(catName => {
            const catQuizzes = categories[catName];
            if (catQuizzes.length === 0) return;

            const section = document.createElement('section');
            section.className = 'netflix-section';
            section.innerHTML = `
                <h3 class="netflix-row-title">${catName}</h3>
                <div class="netflix-row">
                    ${catQuizzes.map(q => renderQuizPoster(q)).join('')}
                </div>
            `;
            container.appendChild(section);
        });

        // Bind Global de Eventos
        container.querySelectorAll('.netflix-poster').forEach(poster => {
            poster.onclick = () => {
                const id = poster.dataset.id;
                const action = poster.dataset.action;
                if (action === 'simulado') {
                    window.history.pushState({ quizId: id }, '', '/');
                    navigateFn('simulado');
                } else { navigateFn('account'); }
            };
        });

        // Update Hero Button Target
        const heroBtn = document.getElementById('hero-play-btn');
        if (heroBtn && quizzes.length > 0) {
            heroBtn.onclick = () => {
                window.history.pushState({ quizId: quizzes[0].id }, '', '/');
                navigateFn('simulado');
            };
        }

        if (window.lucide) lucide.createIcons();
    }

    function renderQuizPoster(q) {
        const isUnlocked = q.accessStatus === 'unlocked' || q.accessStatus === 'free_trial_available';
        const colors = { 'Direito': '#1e3a8a', 'Economia': '#065f46', 'Contabilidade': '#991b1b', 'Informática': '#3730a3', 'Default': '#1e293b' };
        const posterColor = colors[q.subject] || colors['Default'];
        const posterImage = q.image_url;
        const posterStyle = posterImage 
            ? `background: linear-gradient(to top, rgba(0,0,0,0.9), transparent), url('${posterImage}') center/cover;` 
            : `background-color: ${posterColor};`;

        return `
            <div class="netflix-poster" data-id="${q.id}" data-action="${isUnlocked ? 'simulado' : 'account'}">
                <div class="netflix-poster-thumb" style="${posterStyle}">
                    <div class="play-overlay">
                        <i data-lucide="${isUnlocked ? 'play-circle' : 'crown'}" style="width:42px; height:42px; color:white;"></i>
                    </div>
                    ${!isUnlocked ? '<div class="netflix-badge-premium">Premium</div>' : ''}
                </div>
                <div class="netflix-poster-info">
                    <div class="netflix-poster-title">${q.title}</div>
                    <div class="netflix-poster-meta">
                        <span style="font-weight:700; color:var(--gray-300);">${q.totalQuestions || 0} QUESTÕES</span>
                        ${q.is_premium ? '<i data-lucide="crown" style="width:12px; color:#f59e0b;"></i>' : ''}
                    </div>
                </div>
            </div>
        `;
    }
}
