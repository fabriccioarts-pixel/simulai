import { apiFetch } from '../config.js';

export async function renderAdmin(container) {
    let quizzes = [];
    let currentQuizId = null;
    let currentTab = 'quizzes'; // 'quizzes', 'users', 'analytics'

    const viewContent = document.createElement('div');
    viewContent.className = 'admin-container';
    container.innerHTML = '';
    container.appendChild(viewContent);

    const loadData = async () => {
        try {
            renderLoading();
            const res = await apiFetch(`/api/admin/quizzes`);
            if (res.status === 401) {
                renderError("Acesso restrito. Você precisa estar logado como administrador.");
                return;
            }
            const json = await res.json();
            if (json.success) {
                quizzes = json.quizzes || [];
                renderLayout();
                renderTabContent();
            } else {
                renderError("Falha no servidor: " + (json.error || "Erro desconhecido"));
            }
        } catch(e) {
            renderError("Falha ao carregar simulados: " + e.message);
        }
    };

    const renderLoading = () => {
        viewContent.innerHTML = `<div style="padding:4rem; text-align:center;"><div class="loader">Carregando painel de controle...</div></div>`;
    };

    const renderError = (msg) => {
        const isColumnError = msg.includes("no such column") || msg.includes("quiz_id");
        viewContent.innerHTML = `
            <div style="padding:4rem; text-align:center; color:#ef4444;">
                <h3>Erro de Conexão</h3>
                <p>${msg}</p>
                <div style="display:flex; gap:1rem; justify-content:center; margin-top:1.5rem;">
                    <button class="btn-primary" id="retry-admin">Tentar Novamente</button>
                    ${isColumnError ? '<button class="btn-minimal" id="fix-db-btn" style="border:1px solid #ef4444; color:#ef4444;">Corrigir Banco de Dados</button>' : ''}
                </div>
            </div>`;
        document.getElementById('retry-admin').onclick = loadData;
        if (isColumnError) {
            document.getElementById('fix-db-btn').onclick = async () => {
                const btn = document.getElementById('fix-db-btn');
                btn.disabled = true;
                btn.innerText = "Corrigindo...";
                try {
                    const res = await apiFetch('/api/admin/migrate/fix-db');
                    const json = await res.json();
                    if (json.success) {
                        window.showAlert("Sucesso", "Banco de dados sincronizado! Recarregando...", "success");
                        loadData();
                    } else { window.showAlert("Erro", json.error, "error"); }
                } catch(e) { window.showAlert("Falha", e.message, "error"); }
                btn.disabled = false;
                btn.innerText = "Corrigir Banco de Dados";
            };
        }
    };

    const renderLayout = () => {
        viewContent.innerHTML = `
            <div style="display:grid; grid-template-columns: 240px 1fr; gap:2rem; min-height:80vh;">
                <!-- SIDEBAR -->
                <aside style="border-right: 1px solid var(--border); padding-right:1rem;">
                    <h2 style="font-size:1.2rem; margin-bottom:2rem; color:white;">Admin Simulai</h2>
                    <nav id="admin-nav" style="display:flex; flex-direction:column; gap:0.5rem;">
                        <button class="nav-btn-admin ${currentTab === 'quizzes' ? 'active' : ''}" data-tab="quizzes"><i data-lucide="layout"></i> Simulados</button>
                        <button class="nav-btn-admin ${currentTab === 'users' ? 'active' : ''}" data-tab="users"><i data-lucide="users"></i> Usuários</button>
                        <button class="nav-btn-admin ${currentTab === 'analytics' ? 'active' : ''}" data-tab="analytics"><i data-lucide="pie-chart"></i> Analytics</button>
                        <hr style="border:none; border-top:1px solid var(--border); margin:1rem 0;">
                        <button class="nav-btn-admin" id="sync-db-sidebar-btn" style="color:var(--primary);"><i data-lucide="refresh-cw"></i> Sincronizar Banco</button>
                    </nav>
                </aside>

                <!-- MAIN -->
                <main id="admin-main-area">
                    <!-- CONTENT INJECTED HERE -->
                </main>
            </div>

            <!-- MODALS -->
            <div id="quiz-modal" class="modal-overlay hidden">
                <div class="modal-content">
                    <button class="close-btn" onclick="document.getElementById('quiz-modal').classList.add('hidden')"><i data-lucide="x"></i></button>
                    <div class="modal-header">
                        <h3 id="quiz-modal-title">Novo Simulado</h3>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="edit-quiz-id">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">
                            <div style="grid-column:1/-1;">
                                <label class="label-admin">Nome do Simulado</label>
                                <input type="text" id="nq-title" class="input-dark" placeholder="Ex: Simulado ATA #01">
                            </div>
                            <div style="grid-column:1/-1;">
                                <label class="label-admin">Descrição Breve</label>
                                <textarea id="nq-desc" class="input-dark" rows="3" placeholder="Do que se trata este simulado?"></textarea>
                            </div>
                            <div>
                                <label class="label-admin">Disciplina/Matéria</label>
                                <input type="text" id="nq-subject" class="input-dark" placeholder="Ex: Direito Administrativo">
                            </div>
                            <div>
                                <label class="label-admin">Dificuldade</label>
                                <select id="nq-difficulty" class="input-dark">
                                    <option value="easy">Fácil</option>
                                    <option value="medium" selected>Média</option>
                                    <option value="hard">Difícil</option>
                                </select>
                            </div>
                            <div style="grid-column:1/-1;">
                                <label class="label-admin">URL da Capa (Imagem)</label>
                                <input type="text" id="nq-image" class="input-dark" placeholder="https://exemplo.com/imagem.jpg">
                            </div>
                            <div style="grid-column:1/-1;">
                                <label class="label-admin">Anexos/Download (Links separados por vírgula)</label>
                                <input type="text" id="nq-attachments" class="input-dark" placeholder="https://link1.pdf, https://link2.zip">
                            </div>
                        </div>
                        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.05);">
                            <label style="display:flex; align-items:center; gap:0.8rem; color:var(--gray-200); cursor:pointer; font-size:0.95rem;">
                                <input type="checkbox" id="nq-premium" style="width:18px; height:18px; border-radius:4px;"> Exclusivo para Assinantes (Premium)
                            </label>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:3rem;">
                            <button id="nq-cancel" class="btn-secondary">Cancelar</button>
                            <button id="nq-save" class="btn-primary" style="padding-left:2.5rem; padding-right:2.5rem;">Salvar Simulado</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="new-question-modal" class="modal-overlay hidden">
                <div class="modal-content" style="max-width:800px;">
                    <button class="close-btn" onclick="document.getElementById('new-question-modal').classList.add('hidden')"><i data-lucide="x"></i></button>
                    <div class="modal-header">
                        <h3 id="question-modal-title">Adicionar Questão</h3>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="edit-q-id">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                            <div style="grid-column: 1/-1;">
                                <label class="label-admin">Enunciado da Questão</label>
                                <textarea id="nq-text" class="input-dark" rows="5" placeholder="Escreva o enunciado aqui..."></textarea>
                            </div>
                            <div>
                                <label class="label-admin">Opção A</label>
                                <input type="text" id="nq-a" class="input-dark" placeholder="Texto da opção A">
                            </div>
                            <div>
                                <label class="label-admin">Opção B</label>
                                <input type="text" id="nq-b" class="input-dark" placeholder="Texto da opção B">
                            </div>
                            <div>
                                <label class="label-admin">Opção C</label>
                                <input type="text" id="nq-c" class="input-dark" placeholder="Texto da opção C">
                            </div>
                            <div>
                                <label class="label-admin">Opção D</label>
                                <input type="text" id="nq-d" class="input-dark" placeholder="Texto da opção D">
                            </div>
                            <div>
                                <label class="label-admin">Resposta Correta</label>
                                <select id="nq-correct" class="input-dark">
                                    <option value="A">Opção A</option>
                                    <option value="B">Opção B</option>
                                    <option value="C">Opção C</option>
                                    <option value="D">Opção D</option>
                                </select>
                            </div>
                            <div>
                                <label class="label-admin">Disciplina</label>
                                <input type="text" id="nq-discipline" class="input-dark" placeholder="Ex: Direito Constitucional">
                            </div>
                            <div style="grid-column: 1/-1;">
                                <label class="label-admin">Explicação Detalhada (Markdown)</label>
                                <textarea id="nq-explanation" class="input-dark" rows="4" placeholder="Explique por que esta é a resposta correta..."></textarea>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:3rem;">
                            <button id="nq-cancel-manual" class="btn-secondary">Cancelar</button>
                            <button id="nq-save-manual" class="btn-primary" style="padding-left:2.5rem; padding-right:2.5rem;">Salvar Questão</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="csv-modal" class="modal-overlay hidden">
                <div class="modal-content" style="max-width:600px;">
                    <button class="close-btn" onclick="document.getElementById('csv-modal').classList.add('hidden')"><i data-lucide="x"></i></button>
                    <div class="modal-header">
                        <h3>Importar Questões (CSV)</h3>
                    </div>
                    <div class="modal-body">
                        <p style="color:var(--gray-400); font-size:0.85rem; margin-bottom:1.5rem;">Copie e cole os dados separados por vírgula ou ponto-e-vírgula.<br>Campos: question, a, b, c, d, correta(1-4), explicacao, disciplina</p>
                        <textarea id="csv-area" rows="10" class="input-dark" style="font-family:'Courier New', monospace; font-size:0.8rem; padding:1.2rem;" placeholder="Constitucional, 'Qual a...', 'Art 1', 'Art 2', 'Art 3', 'Art 4', 1, 'Explicação...'"></textarea>
                        <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:2.5rem;">
                            <button id="csv-cancel" class="btn-secondary">Cancelar</button>
                            <button id="csv-do-import" class="btn-primary" style="padding-left:2.5rem; padding-right:2.5rem;">Importar Tudo</button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .admin-card { background:#111; border:1px solid var(--border); padding:1.5rem; border-radius:12px; transition: all 0.2s; display:flex; flex-direction:column; }
                .admin-card:hover { border-color:var(--gray-400); transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,0,0,0.4); }
                .nav-btn-admin { padding:0.8rem 1.2rem; background:transparent; border:none; color:var(--gray-400); text-align:left; cursor:pointer; border-radius:8px; display:flex; align-items:center; gap:0.8rem; font-weight:500; transition:0.2s; }
                .nav-btn-admin.active { background:rgba(255,255,255,0.1); color:white; }
                .input-dark { width:100%; padding:0.8rem; background:#000; border:1px solid var(--border); color:white; border-radius:6px; margin-top:0.4rem; outline:none; font-size:0.9rem; transition: border-color 0.2s; }
                .input-dark:focus { border-color: var(--gray-400); }
                .label-admin { color:var(--gray-400); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; display:block; margin-top:1rem; }
                .stat-box { background:var(--gray-800); border:1px solid var(--border); padding:1.5rem; border-radius:12px; }
                .stat-box p:first-child { font-size:0.8rem; text-transform:uppercase; color:var(--gray-400); margin-bottom:0.5rem; }
                .stat-box p:last-child { font-size:2rem; font-weight:800; color:white; }
                .hidden { display:none !important; }
            </style>
        `;

        if (window.lucide) lucide.createIcons();

        // Bind Navigation
        const navBtns = viewContent.querySelectorAll('.nav-btn-admin[data-tab]');
        navBtns.forEach(btn => {
            btn.onclick = () => {
                currentTab = btn.dataset.tab;
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTabContent();
            };
        });

        document.getElementById('sync-db-sidebar-btn').onclick = async () => {
            const btn = document.getElementById('sync-db-sidebar-btn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerText = "Sincronizando...";
            try {
                const res = await apiFetch('/api/admin/migrate/fix-db');
                const json = await res.json();
                if (json.success) {
                    window.showAlert("Sincronizado", "Banco de dados atualizado com sucesso.", "success");
                    loadData();
                } else { window.showAlert("Erro de Migração", json.error, "error"); }
            } catch(e) { window.showAlert("Falha Técnica", e.message, "error"); }
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (window.lucide) lucide.createIcons();
        };
    };

    const renderTabContent = async () => {
        const area = document.getElementById('admin-main-area');
        area.innerHTML = `<div class="loader">Carregando...</div>`;

        if (currentTab === 'quizzes') {
            area.innerHTML = `
                <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2.5rem;">
                    <div>
                        <h1 style="font-size:1.8rem; margin-bottom:0.5rem;">Gestão de Simulados</h1>
                        <p style="color:var(--gray-400);">Crie e edite os conteúdos do feed principal.</p>
                    </div>
                    <button id="add-quiz-btn" class="btn-primary" style="display:flex; align-items:center; gap:0.5rem;">
                        <i data-lucide="plus-circle" style="width:18px;"></i> Novo Simulado
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem;">
                    ${quizzes.length === 0 ? '<p style="color:var(--gray-500); grid-column: 1/-1; text-align:center; padding:4rem;">Nenhum simulado cadastrado.</p>' : ''}
                    ${quizzes.map(q => `
                        <div class="admin-card">
                            <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                                <span style="font-size:0.7rem; color:var(--primary); font-weight:700; text-transform:uppercase;">ID: ${q.id.split('-')[0]}</span>
                                <div style="display:flex; gap:0.8rem; align-items:center;">
                                    ${q.is_premium ? '<i data-lucide="crown" style="width:14px; color:#f59e0b;"></i>' : ''}
                                    <button class="btn-edit-quiz btn-minimal" data-id="${q.id}" style="font-size:0.75rem; padding:2px 8px; border:1px solid var(--border); border-radius:4px;">
                                        <i data-lucide="edit-3" style="width:12px; margin-right:4px;"></i> Editar Info
                                    </button>
                                </div>
                            </div>
                            <h3 style="margin-bottom:1rem; font-size:1.1rem; line-height:1.2; color:white;">${q.title}</h3>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.05);">
                                <span style="font-size:0.85rem; color:var(--gray-400);">${q.question_count} questões</span>
                                <button class="btn-manage" data-id="${q.id}" style="background:var(--gray-700); color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; font-weight:600;">
                                    Gerenciar <i data-lucide="settings" style="width:14px;"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            document.getElementById('add-quiz-btn').onclick = () => {
                document.getElementById('quiz-modal-title').innerText = "Novo Simulado";
                document.getElementById('edit-quiz-id').value = "";
                document.getElementById('nq-title').value = "";
                document.getElementById('nq-desc').value = "";
                document.getElementById('nq-subject').value = "";
                document.getElementById('nq-image').value = "";
                document.getElementById('nq-attachments').value = "";
                document.getElementById('nq-premium').checked = false;
                document.getElementById('quiz-modal').classList.remove('hidden');
            };
            
            area.querySelectorAll('.btn-edit-quiz').forEach(btn => {
                btn.onclick = () => {
                    const qId = btn.dataset.id;
                    const q = quizzes.find(item => item.id === qId);
                    document.getElementById('quiz-modal-title').innerText = "Editar Simulado";
                    document.getElementById('edit-quiz-id').value = q.id;
                    document.getElementById('nq-title').value = q.title;
                    document.getElementById('nq-desc').value = q.description || "";
                    document.getElementById('nq-subject').value = q.subject || "";
                    document.getElementById('nq-image').value = q.image_url || "";
                    document.getElementById('nq-attachments').value = q.attachments || "";
                    document.getElementById('nq-premium').checked = !!q.is_premium;
                    document.getElementById('nq-difficulty').value = q.difficulty || "medium";
                    document.getElementById('quiz-modal').classList.remove('hidden');
                };
            });

            area.querySelectorAll('.btn-manage').forEach(btn => btn.onclick = () => renderQuestionsManager(btn.dataset.id));
        } 
        
        else if (currentTab === 'users') {
            try {
                const res = await apiFetch('/api/admin/users');
                const json = await res.json();
                const users = json.users || [];
                area.innerHTML = `
                    <h1 style="font-size:1.8rem; margin-bottom:2rem;">Usuários e Assinaturas</h1>
                    <div style="background:#111; border:1px solid var(--border); border-radius:12px; overflow:hidden;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;">
                            <thead style="background:#000;">
                                <tr>
                                    <th style="padding:1rem; border-bottom:1px solid var(--border);">Usuário</th>
                                    <th style="padding:1rem; border-bottom:1px solid var(--border);">Role</th>
                                    <th style="padding:1rem; border-bottom:1px solid var(--border);">Assinatura</th>
                                    <th style="padding:1rem; border-bottom:1px solid var(--border);">Expira em</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${users.length === 0 ? '<tr><td colspan="4" style="padding:4rem; text-align:center; color:var(--gray-500);">Nenhum usuário cadastrado no momento.</td></tr>' : ''}
                                ${users.map(u => `
                                    <tr style="border-bottom:1px solid var(--border);">
                                        <td style="padding:1rem;">
                                            <div style="font-weight:700;">${u.name || 'Sem Nome'}</div>
                                            <div style="font-size:0.8rem; color:var(--gray-400);">${u.email}</div>
                                        </td>
                                        <td style="padding:1rem;">
                                            <span style="background:${u.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'}; color:${u.role === 'admin' ? '#ef4444' : 'var(--gray-300)'}; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; text-transform:uppercase;">
                                                ${u.role}
                                            </span>
                                        </td>
                                        <td style="padding:1rem;">
                                            <span style="color:${u.sub_status === 'active' ? '#10b981' : 'var(--gray-500)'}; font-weight:600;">
                                                ${u.sub_status === 'active' ? 'ATIVA' : 'INATIVA'}
                                            </span>
                                        </td>
                                        <td style="padding:1rem; color:var(--gray-400);">
                                            ${u.current_period_end ? new Date(u.current_period_end * 1000).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            } catch(e) { area.innerHTML = `<p class="error-box">Erro ao buscar usuários: ${e.message}</p>`; }
        }

        else if (currentTab === 'analytics') {
            try {
                const [statsRes, anaRes] = await Promise.all([
                    apiFetch('/api/admin/stats'),
                    apiFetch('/api/admin/analytics')
                ]);
                const statsJson = await statsRes.json();
                const anaJson = await anaRes.json();
                
                if (!statsJson.success || !anaJson.success) {
                    throw new Error(statsJson.error || anaJson.error || "Erro ao carregar dados.");
                }

                const stats = statsJson.stats || {};
                const ana = anaJson.analytics || {};
                const topQs = ana.topQuizzes || [];
                
                area.innerHTML = `
                    <h1 style="font-size:1.8rem; margin-bottom:2rem;">Analytics Global</h1>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:3rem;">
                        <div class="stat-box"><p>Total de Questões</p><p>${stats.questions || 0}</p></div>
                        <div class="stat-box"><p>Simulados Concluídos</p><p>${ana.totalCompletions || 0}</p></div>
                        <div class="stat-box"><p>Média de Acertos</p><p>${ana.averageGlobalScore || 0}%</p></div>
                        <div class="stat-box"><p>Assinantes Ativos</p><p>${stats.activeSubscriptions || 0}</p></div>
                    </div>

                    <h2 style="font-size:1.3rem; margin-bottom:1rem;">Simulados mais Populares</h2>
                    <div style="background:#111; border:1px solid var(--border); border-radius:12px; padding:1.5rem;">
                        ${topQs.length === 0 ? '<p style="color:var(--gray-500); text-align:center;">Ainda não há dados de conclusões.</p>' : ''}
                        ${topQs.map(q => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px solid var(--gray-800);">
                                <span style="font-weight:600; color:var(--gray-200);">${q.title}</span>
                                <span style="color:var(--primary); font-weight:800;">${q.completions} conclusões</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } catch(e) { area.innerHTML = `<div style="padding:3rem; border:1px solid #ef4444; border-radius:12px; color:#ef4444; text-align:center;"><h3>Erro no Analytics</h3><p>${e.message}</p></div>`; }
        }

        if (window.lucide) lucide.createIcons();
        setupModals(); // Re-vincula os eventos aos novos elementos do DOM
    };

    const renderQuestionsManager = async (quizId) => {
        currentQuizId = quizId;
        const quiz = quizzes.find(q => q.id === quizId);
        const mainArea = document.getElementById('admin-main-area');
        mainArea.innerHTML = `<div class="loader">Carregando questões...</div>`;

        try {
            const res = await apiFetch(`/api/admin/quizzes/${quizId}/questions`);
            const json = await res.json();
            const qs = json.questions || [];

            mainArea.innerHTML = `
                <div style="margin-bottom:1.5rem; cursor:pointer; color:var(--gray-400); font-weight:600; display:flex; align-items:center; gap:0.5rem;" id="back-dash">
                    <i data-lucide="arrow-left" style="width:16px;"></i> Voltar ao Painel
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                    <div>
                        <h2 style="font-size:1.5rem; line-height:1.2;">${quiz.title}</h2>
                        <p style="color:var(--primary); font-size:0.9rem;">Gerenciador de Questões</p>
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <button class="btn-minimal" id="add-q-manual-trigger" style="border:1px solid var(--border);"><i data-lucide="plus" style="width:18px;"></i> Nova Questão</button>
                        <button class="btn-primary" id="import-csv-trigger" style="display:flex; align-items:center; gap:0.5rem;"><i data-lucide="file-up" style="width:18px;"></i> Importar CSV</button>
                        <button class="btn-error" id="del-quiz-trigger" style="background:#ef4444; border:none; color:white; height:38px; width:38px; display:flex; align-items:center; justify-content:center; border-radius:6px; cursor:pointer;"><i data-lucide="trash-2" style="width:20px;"></i></button>
                    </div>
                </div>

                <div style="background:#111; border:1px solid var(--border); border-radius:12px; overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead style="background:#000;">
                            <tr>
                                <th style="padding:1rem; border-bottom:1px solid var(--border); width:180px;">Disciplina</th>
                                <th style="padding:1rem; border-bottom:1px solid var(--border);">Enunciado da Questão</th>
                                <th style="padding:1rem; border-bottom:1px solid var(--border); text-align:right; width:120px;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${qs.length === 0 ? '<tr><td colspan="3" style="padding:4rem; text-align:center; color:var(--gray-500);">Nenhuma questão encontrada.</td></tr>' : ''}
                            ${qs.map(q => `
                                <tr style="border-bottom:1px solid var(--gray-800); transition:0.2s;">
                                    <td style="padding:1rem;"><span style="background:var(--gray-800); font-size:0.7rem; padding:4px 10px; border-radius:30px; font-weight:600; text-transform:uppercase;">${q.discipline || 'Geral'}</span></td>
                                    <td style="padding:1rem; color:var(--gray-300); max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${q.question}</td>
                                    <td style="padding:1rem; text-align:right;">
                                        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                                            <button class="btn-edit-q" data-q='${JSON.stringify(q).replace(/'/g, "&apos;")}' style="background:transparent; border:none; color:var(--gray-400); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>
                                            <button class="btn-del-q" data-id="${q.id}" style="background:transparent; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            if (window.lucide) lucide.createIcons();

            document.getElementById('back-dash').onclick = renderTabContent;
            
            document.getElementById('del-quiz-trigger').onclick = async () => {
                if(confirm("Deseja apagar permanentemente este simulado?")) {
                    await apiFetch(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' });
                    loadData();
                }
            };

            document.getElementById('import-csv-trigger').onclick = () => document.getElementById('csv-modal').classList.remove('hidden');
            document.getElementById('add-q-manual-trigger').onclick = () => {
                document.getElementById('question-modal-title').innerText = "Adicionar Questão";
                document.getElementById('edit-q-id').value = "";
                document.getElementById('new-question-modal').classList.remove('hidden');
            };

            // Event Delegation for Edit and Delete buttons
            const tbody = mainArea.querySelector('tbody');
            if (tbody) {
                tbody.onclick = async (e) => {
                    const editBtn = e.target.closest('.btn-edit-q');
                    const delBtn = e.target.closest('.btn-del-q');

                    if (editBtn) {
                        try {
                            const q = JSON.parse(editBtn.dataset.q);
                            console.log("Editing question:", q.id);
                            document.getElementById('question-modal-title').innerText = "Editar Questão";
                            document.getElementById('edit-q-id').value = q.id;
                            document.getElementById('nq-text').value = q.question;
                            document.getElementById('nq-discipline').value = q.discipline || '';
                            document.getElementById('nq-explanation').value = q.explanation || '';
                            document.getElementById('nq-correct').value = q.answer || 'A';
                            
                            const opts = JSON.parse(q.options || '[]');
                            document.getElementById('nq-a').value = opts.find(o => o.letra === 'A')?.texto || '';
                            document.getElementById('nq-b').value = opts.find(o => o.letra === 'B')?.texto || '';
                            document.getElementById('nq-c').value = opts.find(o => o.letra === 'C')?.texto || '';
                            document.getElementById('nq-d').value = opts.find(o => o.letra === 'D')?.texto || '';
                            
                            document.getElementById('new-question-modal').classList.remove('hidden');
                        } catch(err) { console.error("Error parsing question data", err); }
                    }

                    if (delBtn) {
                        const qId = delBtn.dataset.id;
                        if (confirm("Remover esta questão permanentemente?")) {
                            console.log("Deleting question:", qId);
                            try {
                                const res = await apiFetch(`/api/admin/questions/${qId}`, { method: 'DELETE' });
                                const json = await res.json();
                                if (res.ok && json.success) {
                                    window.showAlert("Sucesso", "Questão removida.", "success");
                                    renderQuestionsManager(quizId);
                                } else {
                                    window.showAlert("Erro", json.error || "Erro ao excluir.", "error");
                                }
                            } catch(err) { 
                                console.error("Delete request failed", err);
                                window.showAlert("Falha", err.message, "error"); 
                            }
                        }
                    }
                };
            }

        } catch(e) { mainArea.innerHTML = `<p class="error-box">Erro: ${e.message}</p>`; }
    };

    // Shared Modal Listeners (Bind once)
    const setupModals = () => {
        document.getElementById('nq-cancel').onclick = () => document.getElementById('quiz-modal').classList.add('hidden');
        document.getElementById('nq-cancel-manual').onclick = () => document.getElementById('new-question-modal').classList.add('hidden');
        document.getElementById('csv-cancel').onclick = () => document.getElementById('csv-modal').classList.add('hidden');

        document.getElementById('nq-save').onclick = async () => {
            const btn = document.getElementById('nq-save');
            const editId = document.getElementById('edit-quiz-id').value;
            const title = document.getElementById('nq-title').value;
            const description = document.getElementById('nq-desc').value;
            const subject = document.getElementById('nq-subject').value;
            const difficulty = document.getElementById('nq-difficulty').value;
            const image_url = document.getElementById('nq-image').value;
            const attachments = document.getElementById('nq-attachments').value;
            const isPremium = document.getElementById('nq-premium').checked;
            
            if (!title) {
                window.showAlert("Erro", "O título é obrigatório.", "error");
                return;
            }
            btn.disabled = true;
            btn.innerText = "Salvando...";
            try {
                const method = editId ? 'PUT' : 'POST';
                const url = editId ? `/api/admin/quizzes/${editId}` : '/api/admin/quizzes';
                
                const res = await apiFetch(url, { 
                    method, 
                    body: JSON.stringify({ 
                        title, subject, difficulty, 
                        description, image_url, attachments,
                        is_premium: isPremium 
                    }) 
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    window.showAlert("Sucesso", editId ? "Simulado atualizado!" : "Simulado criado!", "success");
                    document.getElementById('quiz-modal').classList.add('hidden');
                    loadData();
                } else {
                    window.showAlert("Erro", json.error || "Erro ao salvar simulado.", "error");
                }
            } catch(e) { window.showAlert("Erro", e.message, "error"); }
            btn.disabled = false;
            btn.innerText = "Salvar Simulado";
        };

        document.getElementById('nq-save-manual').onclick = async () => {
            const btn = document.getElementById('nq-save-manual');
            const editId = document.getElementById('edit-q-id').value;
            
            const question = document.getElementById('nq-text').value;
            if (!question) {
                window.showAlert("Erro", "O enunciado é obrigatório.", "error");
                return;
            }

            const qData = {
                quiz_id: currentQuizId,
                question: question,
                discipline: document.getElementById('nq-discipline').value,
                answer: document.getElementById('nq-correct').value,
                explanation: document.getElementById('nq-explanation').value,
                options: JSON.stringify([
                    { letra: 'A', texto: document.getElementById('nq-a').value, correta: document.getElementById('nq-correct').value === 'A' },
                    { letra: 'B', texto: document.getElementById('nq-b').value, correta: document.getElementById('nq-correct').value === 'B' },
                    { letra: 'C', texto: document.getElementById('nq-c').value, correta: document.getElementById('nq-correct').value === 'C' },
                    { letra: 'D', texto: document.getElementById('nq-d').value, correta: document.getElementById('nq-correct').value === 'D' },
                ])
            };
            
            btn.disabled = true;
            btn.innerText = "Salvando...";
            try {
                const method = editId ? 'PUT' : 'POST';
                const url = editId ? `/api/admin/questions/${editId}` : '/api/admin/questions';
                const res = await apiFetch(url, { method, body: JSON.stringify(qData) });
                const json = await res.json();
                
                if (res.ok && json.success) {
                    window.showAlert("Sucesso", editId ? "Questão atualizada!" : "Questão adicionada!", "success");
                    document.getElementById('new-question-modal').classList.add('hidden');
                    // Limpar inputs de questão
                    document.getElementById('nq-text').value = '';
                    document.getElementById('nq-a').value = '';
                    document.getElementById('nq-b').value = '';
                    document.getElementById('nq-c').value = '';
                    document.getElementById('nq-d').value = '';
                    document.getElementById('nq-explanation').value = '';
                    renderQuestionsManager(currentQuizId);
                } else {
                    window.showAlert("Erro", json.error || "Erro ao salvar questão.", "error");
                }
            } catch(e) { window.showAlert("Erro", e.message, "error"); }
            btn.disabled = false;
            btn.innerText = "Salvar Questão";
        };

        document.getElementById('csv-do-import').onclick = async () => {
            const csvStr = document.getElementById('csv-area').value;
            if(!csvStr) return;
            try {
                const res = await apiFetch(`/api/admin/quizzes/${currentQuizId}/import`, {
                    method: 'POST', body: JSON.stringify({ csv: csvStr })
                });
                const resJson = await res.json();
                if(resJson.success) {
                    window.showAlert("Sucesso", `${resJson.imported} questões importadas.`, "success");
                    document.getElementById('csv-modal').classList.add('hidden');
                    renderQuestionsManager(currentQuizId);
                } else { window.showAlert("Erro", resJson.error, "error"); }
            } catch(e) { window.showAlert("Falha", e.message, "error"); }
        };
    };

    await loadData();
}
