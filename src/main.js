// Captura erros globais antes de qualquer coisa
window.onerror = function(msg, url, line, col, error) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = `<div style="padding:2rem; background:#111; color:#ef4444; border:1px solid #ef4444;">
            <h3>Erro Fatal de Carregamento</h3>
            <p>${msg}</p>
            <small>${url} - Linha ${line}</small>
        </div>`;
    }
    return false;
};

// Imports usando caminhos absolutos do Vite para evitar erros de resolução
import { auth, renderLogin, renderAccount } from './modules/auth.js';
import { renderHome } from './modules/home.js';
import { renderSimulado } from './modules/simulado.js';
import { renderSchedule } from './modules/schedule.js';
import { renderAdmin } from './modules/admin.js';

console.log("Simulai: Módulos importados com sucesso.");

const state = {
    currentView: 'home',
    currentUser: null
};

async function updateNavigation() {
    console.log("Simulai: Atualizando navegação...");
    try {
        const [loggedIn, user] = await Promise.all([
            auth.isLoggedIn(),
            auth.getUser()
        ]);

        const mainNav = document.getElementById('main-nav');
        if (mainNav) {
            mainNav.innerHTML = `
                <button class="nav-btn ${state.currentView === 'home' ? 'active' : ''}" data-view="home">
                    <i data-lucide="home"></i> Home
                </button>
                ${loggedIn ? `
                    ${user?.email === 'simulaaihub@gmail.com' ? `
                        <button class="nav-btn" data-view="admin">
                            <i data-lucide="settings"></i> Admin
                        </button>
                    ` : ''}
                ` : `
                    <button class="nav-btn btn-primary" data-view="login" style="padding: 0.5rem 1.2rem; border-radius:30px; font-weight:600;">
                        Entrar
                    </button>
                `}
            `;
            mainNav.querySelectorAll('.nav-btn').forEach(btn => {
                btn.onclick = () => navigate(btn.dataset.view);
            });
        }

        const profileTrigger = document.getElementById('user-profile-trigger');
        if (loggedIn && user && profileTrigger) {
            profileTrigger.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.8rem;">
                    <button class="nav-btn account-avatar" style="width:36px; height:36px; border-radius:50%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem; border:none; cursor:pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                        ${user.name.charAt(0).toUpperCase()}
                    </button>
                </div>
            `;
            const avatar = profileTrigger.querySelector('.account-avatar');
            if (avatar) avatar.onclick = () => navigate('account');
        }

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Simulai: Erro no updateNavigation", e);
    }
}

window.simulaiLogout = () => auth.logout();

async function navigate(view) {
    console.log(`Simulai: Navegando para ${view}`);
    const mainContent = document.getElementById('main-content');
    const searchContainer = document.getElementById('header-search');
    
    if (searchContainer) {
        searchContainer.style.display = view === 'home' ? 'flex' : 'none';
        if (window.lucide) lucide.createIcons();
    }

    state.currentView = view;
    if (mainContent) mainContent.innerHTML = '<div class="loader">Carregando...</div>';
    
    try {
        switch (view) {
            case 'home': await renderHome(mainContent, navigate); break;
            case 'login': renderLogin(mainContent, navigate); break;
            case 'account': await renderAccount(mainContent); break;
            case 'simulado': await renderSimulado(mainContent, navigate); break;
            case 'admin': await renderAdmin(mainContent); break;
            default: if (mainContent) mainContent.innerHTML = '<h2>404 - Not Found</h2>';
        }
        updateNavigation();
    } catch (err) {
        console.error("Simulai: Erro na Navegação", err);
        if (mainContent) {
            mainContent.innerHTML = `<div style="padding:2rem; text-align:center;"><h3 style="color:#ef4444;">Erro de Navegação</h3><p>${err.message}</p></div>`;
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auxiliares Globais
window.showAlert = (title, message, type = 'info') => {
    const modal = document.getElementById('modal-container');
    const body = document.getElementById('modal-body');
    const closeBtn = document.getElementById('close-modal');
    
    if (!modal || !body) {
        alert(`${title}: ${message}`);
        return;
    }

    const icons = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    body.innerHTML = `
        <div style="text-align:center; padding:1.5rem 0;">
            <div style="width:70px; height:70px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 2rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);">
                <i data-lucide="${icons[type] || 'info'}" style="color:${colors[type] || 'white'}; width:36px; height:36px;"></i>
            </div>
            <div class="modal-header" style="border:none; padding:0; margin-bottom:1rem;">
                <h3 style="font-size:1.6rem; color:white;">${title}</h3>
            </div>
            <p style="color:var(--gray-400); margin-bottom:3rem; font-size:1rem; line-height:1.6; max-width:400px; margin-left:auto; margin-right:auto;">${message}</p>
            <button class="btn-primary" style="width:100%; justify-content:center; padding:1rem; font-size:1rem; border-radius:12px;" onclick="document.getElementById('modal-container').classList.add('hidden')">Confirmar</button>
        </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    closeBtn.onclick = () => modal.classList.add('hidden');
};

window.setQuizMode = (active) => {
    const header = document.querySelector('.main-header');
    const footer = document.querySelector('.main-footer');
    const backBtn = document.getElementById('back-home-btn');

    if (active) {
        if (footer) footer.style.display = 'none';
        if (backBtn) {
            backBtn.style.display = 'flex';
            backBtn.onclick = () => {
                if (confirm("Deseja mesmo sair do Simulado? Seu progresso atual será salvo.")) {
                    window.setQuizMode(false);
                    navigate('home');
                }
            };
        }
    } else {
        if (footer) footer.style.display = 'block';
        if (backBtn) backBtn.style.display = 'none';
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log("Simulai: DOM pronto.");
    
    // Configura busca
    const searchContainer = document.getElementById('header-search');
    const searchInput = document.getElementById('global-search-input');
    
    document.addEventListener('click', (e) => {
        if (!searchContainer || !searchInput) return;

        if (searchContainer.contains(e.target)) {
            searchContainer.classList.add('expanded');
            searchInput.focus();
        } else if (searchInput.value.length === 0) {
            searchContainer.classList.remove('expanded');
        }
    });

    navigate('home');
});
