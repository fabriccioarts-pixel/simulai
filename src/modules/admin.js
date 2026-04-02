import { hubData } from '../data/hubData.js';

export function renderAdmin(container) {
    let questions = JSON.parse(JSON.stringify(hubData.quiz));
    let apostilas = hubData.apostilas ? JSON.parse(JSON.stringify(hubData.apostilas)) : [];
    
    // Função para carregar da base D1 real filtrado por CONTEÚDO!
    const loadDB = async (cID = 1) => {
        try {
            const res = await fetch(`https://simulado-api.simulado-ata-mf.workers.dev/questoes?content_id=${cID}`);
            const json = await res.json();
            if (json.success && json.data) {
                questions = json.data.map(q => ({
                    db_id: q.id,
                    id: parseInt(q.original_id) || q.id,
                    disciplina: q.discipline,
                    enunciado: q.question,
                    alternativas: JSON.parse(q.options),
                    explicacao: q.explanation,
                    banca: q.banca || "ESAF",
                    pegadinha_esaf: q.pegadinha || "",
                    content_id: q.content_id
                }));
                
                // Atualizar contadores dinamicamente se existirem na tela
                const countBadge = document.getElementById('q-count-dash');
                if (countBadge) countBadge.innerText = `Total: ${questions.length} cadastradas`;
                
                const tableContainer = document.querySelector('.admin-table-container');
                if (tableContainer) {
                    renderQuestions(cID);
                }
            }
        } catch(e) { /* fallback local silence */ }
    };
    loadDB();
    
    // Mock contents list since we only have ATA right now
    let contents = hubData.contents || [
        { id: 1, title: 'Material ATA', description: 'Preparatório Ministério da Fazenda', items: ['questoes', 'calendario', 'apostilas'] }
    ];
    hubData.contents = contents; // Garantir que salva no export

    // Setup Shell with Modals (persistent part)
    container.innerHTML = `
        <div id="admin-view-content"></div>
        
        <!-- Modal de Novo Conteudo -->
        <div id="new-content-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
            <div style="background:var(--bg-card); padding:2rem; border-radius:12px; border:1px solid var(--border); width:90%; max-width:450px; box-shadow:0 10px 30px rgba(0,0,0,0.5); animation: fade-in 0.2s ease-out;">
                <h3 style="margin-bottom:0.5rem; color:var(--gray-100);">Criar Novo Conteúdo</h3>
                <p style="color:var(--gray-400); font-size:0.85rem; margin-bottom:1.5rem;">Adicione uma nova pasta raiz para organizar provas ou diferentes módulos (ex: INSS 2026).</p>
                <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-300); font-weight:500;">Nome do Módulo/Curso</label>
                <input type="text" id="nc-title" placeholder="Ex: Receita Federal" style="width:100%; padding:0.8rem; margin-bottom:1rem; background:var(--bg-main); border:1px solid var(--border); color:white; border-radius:6px; font-family:inherit;">
                <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-300); font-weight:500;">Descrição Curta</label>
                <input type="text" id="nc-desc" placeholder="Ex: Preparatório Analista Tributário" style="width:100%; padding:0.8rem; margin-bottom:1.5rem; background:var(--bg-main); border:1px solid var(--border); color:white; border-radius:6px; font-family:inherit;">
                <div style="display:flex; justify-content:flex-end; gap:1rem;">
                    <button id="nc-cancel" style="background:transparent; color:var(--gray-400); border:none; padding:0.5rem 1rem; cursor:pointer; font-weight:500; font-size:0.9rem;">Cancelar</button>
                    <button id="nc-save" class="btn-primary" style="padding:0.6rem 1.5rem;">Criar Pasta</button>
                </div>
            </div>
        </div>

        <!-- Modal de Confirmação Master -->
        <div id="confirm-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(6px);">
            <div style="background:var(--bg-card); padding:2.5rem; border-radius:16px; border:1px solid var(--border); width:90%; max-width:400px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.6); animation: scale-up 0.2s ease-out;">
                <div style="width:60px; height:60px; background:rgba(239, 68, 68, 0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem;">
                    <i data-lucide="alert-triangle" style="color:var(--error); width:32px; height:32px;"></i>
                </div>
                <h3 style="margin-bottom:0.75rem; color:var(--gray-100); font-size:1.25rem;">Tem certeza?</h3>
                <p id="confirm-msg" style="color:var(--gray-400); font-size:0.95rem; line-height:1.6; margin-bottom:2rem;">Esta ação é permanente e não poderá ser desfeita.</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <button id="confirm-btn-no" style="background:var(--gray-800); color:white; border:none; padding:0.8rem; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">Cancelar</button>
                    <button id="confirm-btn-yes" style="background:var(--error); color:white; border:none; padding:0.8rem; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.9rem;">Sim, Excluir</button>
                </div>
            </div>
        </div>

        <style>
            @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes scale-up { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        </style>
    `;

    const viewContent = document.getElementById('admin-view-content');

    const setupBreadcrumbs = () => {
        container.querySelectorAll('.crumb-link').forEach(link => {
            link.addEventListener('click', (e) => {
                navigate(e.currentTarget.dataset.nav, { contentId: 1 });
            });
        });
    };

    const renderBreadcrumbs = (crumbs) => {
        return `
            <div style="margin-bottom:1.5rem; font-size:0.9rem; color:var(--gray-400); display:flex; gap:0.5rem; align-items:center;">
                ${crumbs.map((c, i) => `
                    <span style="${i === crumbs.length-1 ? 'color:var(--gray-100); font-weight:600;' : 'cursor:pointer; color:var(--accent); transition:color 0.2s;'}" 
                          ${i !== crumbs.length-1 ? `data-nav="${c.view}" class="crumb-link"` : ''}>
                        ${c.label}
                    </span>
                    ${i !== crumbs.length-1 ? '<i data-lucide="chevron-right" style="width:14px; height:14px;"></i>' : ''}
                `).join('')}
            </div>
        `;
    };

    const navigate = (view, payload = {}) => {
        if (view === 'contents') renderContents();
        else if (view === 'content_dash') renderContentDash(payload.contentId);
        else if (view === 'questions') renderQuestions(payload.contentId);
        else if (view === 'q_form') renderForm(payload.idx, payload.contentId);
        else if (view === 'uploads') renderUploads(payload.contentId);
        else if (view === 'u_form') renderUploadForm(payload.idx, payload.contentId);
        else if (view === 'schedule') renderSchedule(payload.contentId);
        
        if (window.lucide) lucide.createIcons();
    };

    const showConfirm = (msg, onYes) => {
        const cModal = document.getElementById('confirm-modal');
        const cMsg = document.getElementById('confirm-msg');
        const btnYes = document.getElementById('confirm-btn-yes');
        const btnNo = document.getElementById('confirm-btn-no');
        cMsg.innerText = msg;
        cModal.style.display = 'flex';
        if (window.lucide) lucide.createIcons();
        const close = () => { cModal.style.display = 'none'; };
        btnNo.onclick = close;
        btnYes.onclick = () => { onYes(); close(); };
    };

    // 1. Content Dashboard
    const renderContents = () => {
        viewContent.innerHTML = `
            <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h2>Painel do Admin</h2>
                <div style="display:flex; gap: 1rem;">
                    <button id="add-content-btn" class="btn-primary"><i data-lucide="plus"></i> Novo Conteúdo</button>
                    <button id="export-q-btn" class="btn-accent"><i data-lucide="download"></i> Gravar & Exportar JSON</button>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem;">
                ${contents.map(c => `
                    <div class="content-card" style="background:var(--bg-card); border:1px solid var(--border); padding:1.5rem; cursor:pointer; transition:background 0.2s;" data-id="${c.id}">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                            <h3 style="color:var(--gray-100);">${c.title}</h3>
                            <i data-lucide="folder" style="color:var(--gray-400);"></i>
                        </div>
                        <p style="font-size:0.85rem; color:var(--gray-400); margin-bottom:1.5rem;">${c.description}</p>
                        <button class="btn-secondary" style="width:100%; justify-content:center;">Acessar Conteúdo <i data-lucide="arrow-right" style="width:16px; height:16px;"></i></button>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('export-q-btn').addEventListener('click', exportData);
        
        const modal = document.getElementById('new-content-modal');
        document.getElementById('add-content-btn').addEventListener('click', () => {
            modal.style.display = 'flex';
            setTimeout(() => document.getElementById('nc-title').focus(), 100);
        });
        
        document.getElementById('nc-cancel').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        document.getElementById('nc-save').addEventListener('click', () => {
            const title = document.getElementById('nc-title').value.trim();
            const desc = document.getElementById('nc-desc').value.trim();
            
            if (title) {
                contents.push({
                    id: Date.now(),
                    title: title,
                    description: desc || 'Organização manual de projeto',
                    items: ['questoes', 'calendario', 'apostilas']
                });
                renderContents(); // render implicitamente zera tudo e fecha o modal
            } else {
                document.getElementById('nc-title').style.borderColor = 'var(--error)';
            }
        });

        viewContent.querySelectorAll('.content-card').forEach(card => {
            card.addEventListener('click', (e) => {
                navigate('content_dash', { contentId: parseInt(e.currentTarget.dataset.id) });
            });
        });
    };

    // 2. Specific Content Modules
    const renderContentDash = (contentId) => {
        loadDB(contentId); // Puxa as questões específicas ao entrar no módulo
        const content = contents.find(c => c.id === contentId);
        viewContent.innerHTML = `
            ${renderBreadcrumbs([
                { label: 'Painel do Admin', view: 'contents' },
                { label: content.title, view: 'content_dash' }
            ])}
            <div class="admin-header" style="margin-bottom:2rem;">
                <h2>${content.title}</h2>
                <p style="color:var(--gray-400); font-size:0.9rem;">Selecione o módulo para visualizar ou editar as informações dessa estrutura de concurso.</p>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem;">
                <div class="dash-module" data-target="questions" style="background:var(--bg-card); border:1px solid var(--border); padding:2rem; text-align:center; cursor:pointer;">
                    <i data-lucide="list-checks" style="width:32px; height:32px; color:var(--gray-300); margin-bottom:1rem;"></i>
                    <h4 style="color:var(--gray-200);">Questões</h4>
                    <p id="q-count-dash" style="font-size:0.8rem; color:var(--gray-500); margin-top:0.5rem;">Total: ${questions.length} cadastradas</p>
                </div>
                <div class="dash-module" data-target="schedule" style="background:var(--bg-card); border:1px solid var(--border); padding:2rem; text-align:center; cursor:pointer;">
                    <i data-lucide="calendar" style="width:32px; height:32px; color:var(--gray-300); margin-bottom:1rem;"></i>
                    <h4 style="color:var(--gray-200);">Calendário de Estudos</h4>
                    <p style="font-size:0.8rem; color:var(--gray-500); margin-top:0.5rem;">Organização Semanal</p>
                </div>
                <div class="dash-module" data-target="uploads" style="background:var(--bg-card); border:1px solid var(--border); padding:2rem; text-align:center; cursor:pointer;">
                    <i data-lucide="file-text" style="width:32px; height:32px; color:var(--gray-300); margin-bottom:1rem;"></i>
                    <h4 style="color:var(--gray-200);">Apostila e Uploads</h4>
                    <p style="font-size:0.8rem; color:var(--gray-500); margin-top:0.5rem;">Livros, PDFs ou Docs Extras</p>
                </div>
            </div>
        `;

        setupBreadcrumbs();

        container.querySelectorAll('.dash-module').forEach(el => {
            el.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                if (target === 'questions') navigate('questions', { contentId });
                else if (target === 'uploads') navigate('uploads', { contentId });
                else if (target === 'schedule') navigate('schedule', { contentId });
                else alert(`O painel de gerência manual para ${target} está acoplado ao hubData.js e requer edição em código ou implantação avançada para funcionar como editor de blocos.`);
            });
        });
    };

    // 3. Question Table
    const renderQuestions = (contentId) => {
        const content = contents.find(c => c.id === contentId);
        viewContent.innerHTML = `
            ${renderBreadcrumbs([
                { label: 'Painel do Admin', view: 'contents' },
                { label: content.title, view: 'content_dash' },
                { label: 'Questões', view: 'questions' }
            ])}
            <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h2>Banco de Questões</h2>
                <div style="display:flex; gap: 1rem;">
                    <button id="clear-all-q-btn" class="btn-error" style="background:var(--error); color:white; border:none; padding:0.6rem 1.2rem; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="trash-2" style="width:16px; height:16px;"></i> Limpar Banco</button>
                    <button id="add-q-btn" class="btn-primary"><i data-lucide="plus"></i> Nova Questão</button>
                </div>
            </div>
            
            <div class="admin-table-container" style="overflow-x:auto; background:var(--bg-card); border:1px solid var(--border);">
                <table class="admin-table" style="width:100%; text-align:left; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); background:var(--gray-950);">
                            <th style="padding:1rem; color:var(--text-light);">ID</th>
                            <th style="padding:1rem; color:var(--text-light);">Disciplina</th>
                            <th style="padding:1rem; color:var(--text-light);">Enunciado</th>
                            <th style="padding:1rem; text-align:right; color:var(--text-light);">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${questions.map((q, index) => `
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:1rem; color:var(--gray-400);">${q.id}</td>
                                <td style="padding:1rem;"><span class="discipline-tag" style="background:var(--gray-700); padding:4px 8px;">${q.disciplina}</span></td>
                                <td style="padding:1rem; font-size:0.85rem; color:var(--gray-300); max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${q.enunciado}</td>
                                <td style="padding:1rem; text-align:right;">
                                    <button class="btn-secondary btn-edit" data-idx="${index}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Editar</button>
                                    <button class="btn-error btn-remove-q" data-idx="${index}" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--error); color:white; border:none; border-radius:4px; cursor:pointer; margin-left:4px;">Excluir</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        setupBreadcrumbs();

        document.getElementById('add-q-btn').addEventListener('click', () => navigate('q_form', { idx: -1, contentId }));

        document.getElementById('clear-all-q-btn').addEventListener('click', async () => {
            showConfirm("⚠️ Deseja apagar TODAS as questões deste conteúdo definitivamente?", async () => {
                try {
                    const btn = document.getElementById('clear-all-q-btn');
                    btn.disabled = true;
                    btn.innerHTML = "Limpando...";
                    const res = await fetch(`https://simulado-api.simulado-ata-mf.workers.dev/questoes/limpar?content_id=${contentId}`, { 
                        method: 'DELETE',
                        headers: { "Authorization": "Bearer 123456" }
                    });
                    if (!res.ok) throw new Error(await res.text());
                    await loadDB(contentId);
                    alert("Banco de dados limpo!");
                } catch (err) {
                    alert("Erro: " + err.message);
                    btn.disabled = false;
                    btn.innerHTML = "Limpar Banco";
                }
            });
        });

        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                navigate('q_form', { idx: parseInt(e.currentTarget.dataset.idx), contentId });
            });
        });
        container.querySelectorAll('.btn-remove-q').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const q = questions[idx];
                const btnEl = e.currentTarget;

                showConfirm(`Deseja excluir permanentemente a questão ID ${q.id}?`, async () => {
                    if(q.db_id) {
                        try {
                            btnEl.innerText = "...";
                            const res = await fetch(`https://simulado-api.simulado-ata-mf.workers.dev/questoes/${q.db_id}`, { 
                                method: "DELETE",
                                headers: { "Authorization": "Bearer 123456" }
                            });
                            if (!res.ok) throw new Error("Erro na API");
                            await loadDB(contentId);
                        } catch(err) { 
                            alert("Erro: " + err.message); 
                            btnEl.innerText = "Excluir";
                        }
                    } else {
                        questions.splice(idx, 1);
                        renderQuestions(contentId);
                    }
                });
            });
        });
    };

    // 4. Question Form
    const renderForm = (idx, contentId) => {
        const content = contents.find(c => c.id === contentId);
        const isEdit = idx >= 0;
        const q = isEdit ? questions[idx] : {
            id: Date.now(),
            disciplina: '',
            nivel: 'medio',
            banca: 'ESAF',
            enunciado: '',
            alternativas: [
                { letra: 'A', texto: '', correta: true },
                { letra: 'B', texto: '', correta: false },
                { letra: 'C', texto: '', correta: false },
                { letra: 'D', texto: '', correta: false },
                { letra: 'E', texto: '', correta: false }
            ],
            explicacao: '',
            pegadinha_esaf: '',
            tags: []
        };

        viewContent.innerHTML = `
            ${renderBreadcrumbs([
                { label: 'Painel do Admin', view: 'contents' },
                { label: content.title, view: 'content_dash' },
                { label: 'Questões', view: 'questions' },
                { label: isEdit ? 'Editar Questão' : 'Nova Questão', view: '' }
            ])}
            <div class="admin-form" style="background:var(--bg-card); padding:2rem; border:1px solid var(--border);">
                <h3 style="margin-bottom:1.5rem; color:var(--gray-100);">${isEdit ? 'Edição Rápida da Questão' : 'Criar Nova Questão para o Banco'}</h3>
                
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">ID Único</label>
                        <input type="number" id="q-id" value="${q.id}" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Disciplina (ex: Matemática)</label>
                        <input type="text" id="q-disciplina" value="${q.disciplina}" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Banca</label>
                        <input type="text" id="q-banca" value="${q.banca}" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                    </div>
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Enunciado (Markdown suportado)</label>
                    <textarea id="q-enunciado" rows="4" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white; font-family:inherit;">${q.enunciado}</textarea>
                </div>

                <h4 style="margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem; color:var(--gray-200);">Alternativas (Selecione a correta)</h4>
                <div id="q-alternativas" style="margin-bottom:1.5rem;">
                    ${q.alternativas.map((opt, i) => `
                        <div style="display:flex; gap:1rem; margin-bottom:0.75rem; align-items:center;">
                            <input type="radio" name="correta" value="${i}" ${opt.correta ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
                            <span style="font-weight:bold; color:var(--gray-400);">${opt.letra}</span>
                            <input type="text" class="opt-input" data-idx="${i}" value="${opt.texto}" style="flex:1; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                        </div>
                    `).join('')}
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Explicação Passo a Passo</label>
                    <textarea id="q-explicacao" rows="3" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white; font-family:inherit;">${q.explicacao}</textarea>
                </div>

                <div style="margin-bottom:2rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Pegadinha (Aviso Rápido Opcional)</label>
                    <input type="text" id="q-pegadinha" value="${q.pegadinha_esaf || ''}" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                </div>

                <button id="save-q-btn" class="btn-primary" style="width:100%; justify-content:center;"><i data-lucide="save"></i> Salvar Alterações na Sensão Atual</button>
            </div>
        `;

        setupBreadcrumbs();
        
        document.getElementById('save-q-btn').addEventListener('click', async () => {
            q.id = parseInt(document.getElementById('q-id').value) || q.id;
            q.disciplina = document.getElementById('q-disciplina').value || 'Sem Disciplina';
            q.banca = document.getElementById('q-banca').value;
            q.enunciado = document.getElementById('q-enunciado').value;
            q.explicacao = document.getElementById('q-explicacao').value;
            q.pegadinha_esaf = document.getElementById('q-pegadinha').value;
            
            const selectedCorrectObj = document.querySelector('input[name="correta"]:checked');
            const correctIdx = selectedCorrectObj ? parseInt(selectedCorrectObj.value) : 0;
            let correctLetra = "A";
            
            document.querySelectorAll('.opt-input').forEach(input => {
                const oIdx = parseInt(input.dataset.idx);
                q.alternativas[oIdx].texto = input.value;
                q.alternativas[oIdx].correta = (oIdx === correctIdx);
                if (oIdx === correctIdx) correctLetra = q.alternativas[oIdx].letra;
            });

            const btn = document.getElementById('save-q-btn');
            btn.disabled = true;
            btn.innerHTML = `<i data-lucide="loader"></i> Salvando no Banco de Dados...`;

            try {
                // Post to API Cloudflare D1
                const payloadObj = {
                    id: q.db_id,
                    original_id: q.id.toString(),
                    discipline: q.disciplina,
                    question: q.enunciado,
                    options: JSON.stringify(q.alternativas),
                    answer: correctLetra,
                    explanation: q.explicacao,
                    banca: q.banca,
                    pegadinha: q.pegadinha_esaf,
                    content_id: contentId
                };
                
                const apiUrl = `https://simulado-api.simulado-ata-mf.workers.dev/questoes?content_id=${contentId}`;
                const res = await fetch(apiUrl, {
                    method: q.db_id ? "PUT" : "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": "Bearer 123456"
                    },
                    body: JSON.stringify(payloadObj)
                });
                
                if (!res.ok) {
                    throw new Error(await res.text());
                }
                
                await loadDB(contentId); // sincroniza novidades
                navigate('questions', { contentId });
            } catch(e) {
                alert(`Erro grave de Banco de Dados: ${e.message}\nVerifique se o Worker (API) está rodando em https://simulado-api.simulado-ata-mf.workers.dev`);
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="save"></i> Tentar Novamente`;
            }
        });
    };

    const renderUploads = (contentId) => {
        const content = contents.find(c => c.id === contentId);
        viewContent.innerHTML = `
            ${renderBreadcrumbs([
                { label: 'Painel do Admin', view: 'contents' },
                { label: content.title, view: 'content_dash' },
                { label: 'Apostilas e Uploads', view: 'uploads' }
            ])}
            <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h2>Apostilas e Uploads</h2>
                <div style="display:flex; gap: 1rem;">
                    <button id="add-u-btn" class="btn-primary"><i data-lucide="upload"></i> Novo Arquivo</button>
                </div>
            </div>
            
            <div class="admin-table-container" style="overflow-x:auto; background:var(--bg-card); border:1px solid var(--border);">
                <table class="admin-table" style="width:100%; text-align:left; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border); background:var(--gray-950);">
                            <th style="padding:1rem; color:var(--text-light);">Nome do Material</th>
                            <th style="padding:1rem; color:var(--text-light);">Caminho/URL</th>
                            <th style="padding:1rem; text-align:right; color:var(--text-light);">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apostilas.length === 0 ? '<tr><td colspan="3" style="padding:2rem; text-align:center; color:var(--gray-500);">Nenhum material cadastrado.</td></tr>' : ''}
                        ${apostilas.map((a, index) => `
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:1rem; color:var(--gray-200); font-weight:bold;">${a.title}</td>
                                <td style="padding:1rem; color:var(--gray-400); font-family:monospace; font-size:0.85rem;">${a.path}</td>
                                <td style="padding:1rem; text-align:right;">
                                    <button class="btn-error btn-remove-u" data-idx="${index}" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--error); color:white; border:none; border-radius:4px; cursor:pointer;">Remover</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top:2rem; padding:1.5rem; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); border-radius:6px;">
                <h4 style="color:#60a5fa; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="info"></i> Como funciona Offline?</h4>
                <p style="color:var(--gray-300); font-size:0.85rem; line-height:1.5;">Como este projeto roda sem um servidor backend final (APIs e Banco de Dados), o upload aqui funciona como um <strong>Catálogo Virtual</strong>. Adicione clicando em Novo Arquivo. Em seguida, mova/arraste o arquivo PDF físico do seu computador direto para a pasta <code>public/materiais/</code> dentro do projeto.</p>
            </div>
        `;

        setupBreadcrumbs();
        
        document.getElementById('add-u-btn').addEventListener('click', () => navigate('u_form', { idx: -1, contentId }));
        container.querySelectorAll('.btn-remove-u').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (confirm('Remover este material da lista?')) {
                    apostilas.splice(idx, 1);
                    navigate('uploads', { contentId });
                }
            });
        });
    };

    const renderUploadForm = (idx, contentId) => {
        const content = contents.find(c => c.id === contentId);
        viewContent.innerHTML = `
            ${renderBreadcrumbs([
                { label: 'Painel do Admin', view: 'contents' },
                { label: content.title, view: 'content_dash' },
                { label: 'Apostilas e Uploads', view: 'uploads' },
                { label: 'Novo Upload', view: '' }
            ])}
            <div class="admin-form" style="background:var(--bg-card); padding:2rem; border:1px solid var(--border);">
                <h3 style="margin-bottom:1.5rem; color:var(--gray-100);">Cadastrar Material Complementar</h3>
                
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Nome / Título do Material</label>
                    <input type="text" id="u-title" placeholder="Ex: Apostila de Direito Administrativo - 2026" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--gray-400);">Selecionar Arquivo (PDF, DOCX, ZIP)</label>
                    <input type="file" id="u-file" style="width:100%; padding:0.6rem; background:var(--gray-900); border:1px solid var(--border); color:white;">
                    <small style="color:var(--gray-500); display:block; margin-top:0.5rem;">O nome base do arquivo será registrado no sistema para referenciar o documento na pasta pública.</small>
                </div>

                <button id="save-u-btn" class="btn-primary" style="width:100%; justify-content:center;"><i data-lucide="save"></i> Salvar Material na Sessão</button>
            </div>
        `;

        setupBreadcrumbs();

        document.getElementById('save-u-btn').addEventListener('click', () => {
            const title = document.getElementById('u-title').value;
            const fileInput = document.getElementById('u-file');

            if (!title) return alert('Por favor, informe o título do material.');
            if (fileInput.files.length === 0) return alert('Selecione um arquivo do seu computador para referenciar.');

            const filename = fileInput.files[0].name;
            const path = `/materiais/${filename}`;

            apostilas.push({ id: Date.now(), title, path, contentId });
            navigate('uploads', { contentId });
        });
    };

    const renderSchedule = (contentId) => {
        const content = contents.find(c => c.id === contentId);
        viewContent.innerHTML = `
            ${renderBreadcrumbs([
                { label: 'Painel do Admin', view: 'contents' },
                { label: content.title, view: 'content_dash' },
                { label: 'Calendário de Estudos', view: 'schedule' }
            ])}
            <div class="admin-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <div>
                    <h2 style="font-size:1.75rem;">Editor de Cronograma</h2>
                    <p style="color:var(--gray-400); font-size:0.9rem;">Gerencie o percurso de 12 semanas do aluno de forma visual.</p>
                </div>
                <div style="display:flex; gap: 1rem;">
                    <button id="add-week-btn" class="btn-secondary"><i data-lucide="plus"></i> Nova Semana</button>
                    <button id="export-schedule-btn" class="btn-primary"><i data-lucide="download"></i> Exportar Dados</button>
                </div>
            </div>
            
            <div id="schedule-editor-container" class="schedule-editor">
                ${hubData.schedule.map((weekData, wIdx) => `
                    <div class="week-editor-card" style="background:var(--bg-card); border:1px solid var(--border); margin-bottom:2rem; padding:1.5rem; border-radius:8px; animation: slide-up 0.3s ease-out;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:1rem;">
                            <h3 style="font-size:1.1rem; color:var(--gray-100);">Semana ${weekData.week}</h3>
                            <button class="btn-remove-week" data-widx="${wIdx}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size:0.8rem;"><i data-lucide="trash-2"></i> Remover Semana</button>
                        </div>
                        <div class="days-editor-grid" style="display:grid; grid-template-columns: 80px 180px 1fr 1fr 40px; gap:1rem; align-items:center; font-size:0.75rem; color:var(--gray-500); padding-bottom:0.8rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">
                            <div>Dia</div>
                            <div>Disciplina</div>
                            <div>Tópico Teórico</div>
                            <div>Atividade Sugerida</div>
                            <div></div>
                        </div>
                        <div class="days-list-editor" data-widx="${wIdx}">
                            ${weekData.days.map((day, dIdx) => `
                                <div class="day-editor-row" style="display:grid; grid-template-columns: 80px 180px 1fr 1fr 40px; gap:1rem; margin-bottom:0.75rem;">
                                    <input type="text" value="${day.day}" class="input-flat schedule-input" data-widx="${wIdx}" data-didx="${dIdx}" data-field="day" placeholder="Ex: Seg">
                                    <input type="text" value="${day.discipline}" class="input-flat schedule-input" data-widx="${wIdx}" data-didx="${dIdx}" data-field="discipline" placeholder="Disciplina">
                                    <input type="text" value="${day.topic || ''}" class="input-flat schedule-input" data-widx="${wIdx}" data-didx="${dIdx}" data-field="topic" placeholder="Assunto Principal">
                                    <input type="text" value="${day.activity || ''}" class="input-flat schedule-input" data-widx="${wIdx}" data-didx="${dIdx}" data-field="activity" placeholder="Descrição curta da tarefa">
                                    <button class="btn-remove-day" data-widx="${wIdx}" data-didx="${dIdx}" style="background:transparent; border:none; color:var(--gray-600); cursor:pointer;"><i data-lucide="x-circle" style="width:16px;"></i></button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn-add-day btn-secondary" data-widx="${wIdx}" style="font-size:0.8rem; padding:0.4rem 0.8rem; margin-top:1rem; border-style:dashed; width:100%; justify-content:center;">+ Adicionar Dia</button>
                    </div>
                `).join('')}
            </div>

            <style>
                .input-flat { background:var(--gray-950); border:1px solid var(--border); color:var(--gray-200); padding:0.5rem; font-family:inherit; font-size:0.85rem; border-radius:4px; transition:all 0.15s; }
                .input-flat:focus { border-color:var(--gray-400); outline:none; background:var(--gray-900); }
                .input-flat::placeholder { color:var(--gray-700); }
                @keyframes slide-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
            </style>
        `;

        setupBreadcrumbs();
        if (window.lucide) lucide.createIcons();

        // Listen for all input changes
        viewContent.querySelectorAll('.schedule-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const { widx, didx, field } = e.target.dataset;
                hubData.schedule[widx].days[didx][field] = e.target.value;
            });
        });

        // Add Week
        document.getElementById('add-week-btn').addEventListener('click', () => {
            const nextWeekNum = hubData.schedule.length + 1;
            hubData.schedule.push({
                week: nextWeekNum.toString(),
                days: [{ day: 'Seg', discipline: 'Nova Disciplina', topic: 'Novo Assunto', activity: 'Tarefa sugerida...' }]
            });
            renderSchedule(contentId);
        });

        // Add Day
        viewContent.querySelectorAll('.btn-add-day').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wIdx = e.currentTarget.dataset.widx;
                hubData.schedule[wIdx].days.push({ day: 'Novo', discipline: '', topic: '', activity: '' });
                renderSchedule(contentId);
            });
        });

        // Remove Week
        viewContent.querySelectorAll('.btn-remove-week').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wIdx = e.currentTarget.dataset.widx;
                if(confirm('Deseja remover toda a ' + hubData.schedule[wIdx].week + '?')) {
                    hubData.schedule.splice(wIdx, 1);
                    renderSchedule(contentId);
                }
            });
        });

        // Remove Day
        viewContent.querySelectorAll('.btn-remove-day').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { widx, didx } = e.currentTarget.dataset;
                hubData.schedule[widx].days.splice(didx, 1);
                renderSchedule(contentId);
            });
        });

        // Export data
        document.getElementById('export-schedule-btn').addEventListener('click', exportData);
    };

    const exportData = () => {
        const fullData = {
            ...hubData,
            quiz: questions,
            apostilas: apostilas
        };
        hubData.quiz = questions; // Updates RAM immediately
        hubData.apostilas = apostilas;

        const str = `export const hubData = ${JSON.stringify(fullData, null, 4)};`;
        const blob = new Blob([str], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hubData.js';
        a.click();
        URL.revokeObjectURL(url);
        alert('O download das questões atualizadas concluiu! Substitua /src/data/hubData.js pelo novo arquivo modificado.');
    };

    navigate('contents');
}
