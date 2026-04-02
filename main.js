import './style.css';
import { renderHome } from './src/modules/home.js';
import { renderSchedule } from './src/modules/schedule.js';
import { renderSimulado } from './src/modules/simulado.js';
import { renderAdmin } from './src/modules/admin.js';
import { auth, renderLogin, renderRegister, renderAccount } from './src/modules/auth.js';

// SINALIZADOR DE ALERTAS CUSTOMIZADOS (Identidade Simulai)
window.showAlert = (title, message, type = 'info') => {
    const existing = document.getElementById('simulai-alert');
    if (existing) existing.remove();

    const alertOverlay = document.createElement('div');
    alertOverlay.id = 'simulai-alert';
    alertOverlay.className = 'modal-overlay';
    alertOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; align-items:center; justify-content:center; animation: fade-in 0.2s ease-out;';
    
    alertOverlay.innerHTML = `
        <div style="background:var(--gray-900); width:90%; max-width:400px; padding:2rem; border:1px solid var(--border); box-shadow:0 25px 60px rgba(0,0,0,0.8); text-align:center;">
            <div style="margin-bottom:1.5rem;">
                <i data-lucide="${type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info')}" 
                   style="width:40px; height:40px; color:${type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : 'var(--gray-400)')}"></i>
            </div>
            <h3 style="color:white; font-size:1.15rem; margin-bottom:0.75rem;">${title}</h3>
            <p style="color:var(--gray-400); font-size:0.9rem; margin-bottom:2rem; line-height:1.5;">${message}</p>
            <button id="close-simulai-alert" class="btn-primary" style="width:100%; justify-content:center; font-weight:700;">Entendido</button>
        </div>
    `;

    document.body.appendChild(alertOverlay);
    if (window.lucide) lucide.createIcons();

    document.getElementById('close-simulai-alert').onclick = () => {
        alertOverlay.style.opacity = '0';
        setTimeout(() => alertOverlay.remove(), 200);
    };
};

const mainContent = document.getElementById('main-content');
const mainNav = document.getElementById('main-nav');
const backHomeBtn = document.getElementById('back-home-btn');

const state = { currentView: 'home' };

// Theme Management
const themeToggle = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

async function updateNavigation() {
    const [loggedIn, user] = await Promise.all([
        auth.isLoggedIn(),
        auth.getUser()
    ]);
    const profileTrigger = document.getElementById('user-profile-trigger');

    // Menu Central
    mainNav.innerHTML = `
        <button class="nav-btn" data-view="home">
            <i data-lucide="home"></i> Início
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

    // Avatar no Canto Superior Direito
    if (loggedIn && user && profileTrigger) {
        profileTrigger.innerHTML = `
            <button class="nav-btn account-avatar" data-view="account" style="width:36px; height:36px; border-radius:50%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem; border:none; cursor:pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: transform 0.2s;">
                ${user.name.charAt(0).toUpperCase()}
            </button>
        `;
        profileTrigger.querySelector('.account-avatar').onclick = () => navigate('account');
    } else if (profileTrigger) {
        profileTrigger.innerHTML = '';
    }
    
    if (window.lucide) lucide.createIcons();

    // Re-bind listeners do Menu Central
    mainNav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => navigate(btn.dataset.view);
    });
}

// Global Quiz Mode toggle
window.setQuizMode = (active) => {
    mainNav.style.display = active ? 'none' : '';
    backHomeBtn.style.display = active ? 'inline-flex' : 'none';
};

backHomeBtn.onclick = () => {
    window.setQuizMode(false);
    navigate('home');
};

async function navigate(view) {
    const publicViews = ['home', 'login', 'register'];
    const loggedIn = await auth.isLoggedIn();
    
    if (!loggedIn && !publicViews.includes(view)) {
        return navigate('login');
    }

    if (view === 'admin') {
        const user = await auth.getUser();
        if (user?.email !== 'simulaaihub@gmail.com') {
            alert('Acesso restrito apenas ao administrador.');
            return navigate('home');
        }
    }

    state.currentView = view;
    mainContent.innerHTML = '<div class="loader">Carregando...</div>';
    
    // Parallelize navigation update and content rendering
    const navUpdatePromise = updateNavigation();
    
    try {
        switch (view) {
            case 'home': await renderHome(mainContent, navigate); break;
            case 'login': renderLogin(mainContent, navigate); break;
            case 'register': renderRegister(mainContent, navigate); break;
            case 'account': await renderAccount(mainContent); break;
            case 'schedule': renderSchedule(mainContent); break;
            case 'simulado': await renderSimulado(mainContent); break;
            case 'admin': renderAdmin(mainContent); break;
            default: navigate('home');
        }
        
        await navUpdatePromise;
        
        mainNav.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    } catch (err) {
        console.error(err);
        mainContent.innerHTML = `<div class="error-box">Erro ao carregar módulo: ${err.message}.</div>`;
    }
}

// Initial state
async function init() {
    await navigate('home');
}
init();
