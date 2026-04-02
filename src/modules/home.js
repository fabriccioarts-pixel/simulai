import { hubData } from '../data/hubData.js';
import { auth } from './auth.js';

export async function renderHome(container, navigateFn) {
    const apostilas = hubData.apostilas || [];

    if (!hubData.quiz || hubData.quiz.length === 0) {
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
            console.warn("Could not sync quiz data", e);
        }
    }

    const [totalQuestions, permissions] = await Promise.all([
        hubData.quiz ? hubData.quiz.length : 0,
        auth.getPermissions()
    ]);
    const hasGeneralAccess = permissions.includes("1");

    container.innerHTML = `
        <div class="home-container" style="padding: 0 1.5rem; animation: fade-in 0.4s ease-out;">
            <div class="home-hero" style="position:relative; border-radius:12px; overflow:hidden; margin-bottom:3rem; background:linear-gradient(to right, #111827 30%, transparent), url('https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&q=80&w=1200') center/cover; padding:4rem 3rem; color:white;">
                <h1 style="font-size:2.5rem; margin-bottom:1rem; font-weight:800; text-shadow:2px 2px 4px rgba(0,0,0,0.5);">Simulai</h1>
                <p style="font-size:1.1rem; color:#d1d5db; max-width:600px; margin-bottom:2rem; text-shadow:1px 1px 2px rgba(0,0,0,0.5); line-height:1.6;">A plataforma definitiva para sua aprovação no Ministério da Fazenda. Acesse os simulados exclusivos focados no padrão e nível da ESAF.</p>
                <button id="hero-play-btn" class="btn-primary" style="font-size:1.1rem; padding:0.8rem 2rem; display:inline-flex; align-items:center; gap:0.5rem; background:#ef4444; border:none; cursor:pointer;"><i data-lucide="play" style="fill:currentColor;"></i> ${hasGeneralAccess ? 'Começar Simulado Geral' : 'Liberar Agora'}</button>
            </div>

            <div class="home-section" style="margin-bottom:3rem;">
                <h3 style="font-size:1.2rem; color:var(--gray-200); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-weight:600;"><i data-lucide="crosshair" style="color:#ef4444;"></i> Acesso Rápido</h3>
                <div class="cards-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1.5rem;">
                    
                    <div class="netflix-card" data-action="${hasGeneralAccess ? 'simulado' : 'account'}" style="background:var(--bg-card); border-radius:8px; overflow:hidden; border:1px solid var(--border); cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; position:relative;">
                        ${!hasGeneralAccess ? `
                            <div style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.7); padding:4px 8px; border-radius:4px; font-size:0.7rem; color:#ef4444; display:flex; align-items:center; gap:4px; z-index:10;">
                                <i data-lucide="lock" style="width:12px;"></i> Bloqueado
                            </div>
                        ` : ''}
                        <div class="netflix-thumb" style="height:150px; background:linear-gradient(135deg, ${hasGeneralAccess ? '#1e293b, #0f172a' : '#111, #222'}); display:flex; align-items:center; justify-content:center; border-bottom:1px solid var(--border);">
                            <i data-lucide="${hasGeneralAccess ? 'clipboard-list' : 'crown'}" style="width:40px; height:40px; color:${hasGeneralAccess ? 'var(--gray-400)' : '#ef4444'};"></i>
                        </div>
                        <div style="padding:1rem;">
                            <h4 style="color:var(--gray-100); margin-bottom:0.25rem; font-weight:600;">Simulado Geral ATA</h4>
                            <p style="font-size:0.85rem; color:var(--gray-500);">${hasGeneralAccess ? totalQuestions + ' Questões • Padrão ESAF' : 'Acesso Premium Exigido'}</p>
                        </div>
                    </div>

                    <div class="netflix-card" data-action="schedule" style="background:var(--bg-card); border-radius:8px; overflow:hidden; border:1px solid var(--border); cursor:pointer; transition:transform 0.2s, box-shadow 0.2s;">
                        <div class="netflix-thumb" style="height:150px; background:linear-gradient(135deg, #1e293b, #0f172a); display:flex; align-items:center; justify-content:center; border-bottom:1px solid var(--border);">
                            <i data-lucide="calendar-days" style="width:40px; height:40px; color:var(--gray-400);"></i>
                        </div>
                        <div style="padding:1rem;">
                            <h4 style="color:var(--gray-100); margin-bottom:0.25rem; font-weight:600;">Calendário de Estudos</h4>
                            <p style="font-size:0.85rem; color:var(--gray-500);">Módulo Semanal de Planejamento</p>
                        </div>
                    </div>

                </div>
            </div>

            ${apostilas.length > 0 ? `
            <div class="home-section" style="margin-bottom:3rem;">
                <h3 style="font-size:1.2rem; color:var(--gray-200); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-weight:600;"><i data-lucide="book-open" style="color:#3b82f6;"></i> Materiais Complementares</h3>
                <div class="cards-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1.5rem;">
                    ${apostilas.map(a => `
                        <a href="${a.path}" target="_blank" style="text-decoration:none;">
                            <div class="netflix-card" style="background:var(--bg-card); border-radius:8px; overflow:hidden; border:1px solid var(--border); cursor:pointer; transition:transform 0.2s, box-shadow 0.2s;">
                                <div class="netflix-thumb" style="height:120px; background:linear-gradient(135deg, #172554, #1e3a8a); display:flex; align-items:center; justify-content:center; border-bottom:1px solid var(--border);">
                                    <i data-lucide="file-text" style="width:36px; height:36px; color:#93c5fd;"></i>
                                </div>
                                <div style="padding:1rem;">
                                    <h4 style="color:var(--gray-100); margin-bottom:0.25rem; font-weight:600; font-size:0.9rem; line-height:1.3;">${a.title}</h4>
                                    <p style="font-size:0.8rem; color:var(--gray-500);">Visualizar Material</p>
                                </div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Setup Hover Effects and clicks
    container.querySelectorAll('.netflix-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.borderColor = 'var(--gray-400)';
            card.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.borderColor = '';
            card.style.boxShadow = '';
        });
        
        card.addEventListener('click', () => {
            if (card.dataset.action) {
                navigateFn(card.dataset.action);
            }
        });
    });

    const heroBtn = document.getElementById('hero-play-btn');
    if (heroBtn) {
        heroBtn.addEventListener('click', () => {
            navigateFn('simulado');
        });
    }
}
