import { apiFetch, getSupabaseClient } from '../config.js';

// Usa o cliente singleton do config.js
// const supabase = getSupabaseClient(); // Usado sob demanda nos métodos para evitar conflitos de carregamento

let cachedUser = null;
let cachedPermissions = null;

export const auth = {
    async getUser() {
        if (cachedUser) return cachedUser;
        const supabase = getSupabaseClient();
        if (!supabase) return null;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        cachedUser = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            created_at: user.created_at,
            phone: user.user_metadata?.phone || ""
        };
        return cachedUser;
    },
    async logout() {
        console.log("Iniciando logout agressivo...");
        try {
            const supabase = getSupabaseClient();
            if (supabase) {
                // Tenta o logout oficial
                await supabase.auth.signOut();
            }
        } catch (e) {
            console.error("Erro no signOut oficial:", e);
        } finally {
            // LIMPEZA DE FORÇA BRUTA
            localStorage.clear();
            sessionStorage.clear();
            
            // Remove cookies relacionados ao Supabase (se houver)
            document.cookie.split(";").forEach(c => {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            console.log("Memória limpa. Redirecionando...");
            
            // Redirecionamento limpo para a home
            window.location.href = window.location.origin + '/';
        }
    },
    async isLoggedIn() {
        if (cachedUser) return true;
        const supabase = getSupabaseClient();
        if (!supabase) return false;
        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    },
    async getPermissions() {
        if (cachedPermissions) return cachedPermissions;
        const user = await this.getUser();
        if (!user) return [];
        try {
            const res = await apiFetch(`/auth/permissions`, {
                method: "POST",
                body: JSON.stringify({ userId: user.id })
            });
            const data = await res.json();
            cachedPermissions = data.permissions || [];
            return cachedPermissions;
        } catch (e) { return []; }
    }
};

export function renderLogin(container, navigateFn) {
    container.innerHTML = `
        <div class="auth-container" style="max-width:400px; margin: 4rem auto; padding:2rem; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: fade-in 0.3s ease-out;">
            <div style="text-align:center; margin-bottom:2rem;">
                <h2 style="font-size:1.75rem; margin-bottom:0.5rem;">Bem-vindo ao Simulai</h2>
                <p style="color:var(--gray-400); font-size:0.9rem;">Acesse sua conta para continuar seus estudos.</p>
            </div>
            
            <form id="login-form" style="display:flex; flex-direction:column; gap:1.2rem;">
                <div class="form-group">
                    <label style="display:block; font-size:0.8rem; color:var(--gray-500); margin-bottom:0.5rem; text-transform:uppercase;">E-mail</label>
                    <input type="email" id="login-email" required style="width:100%; padding:0.8rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px;" placeholder="seu@email.com">
                </div>
                <div class="form-group">
                    <label style="display:block; font-size:0.8rem; color:var(--gray-500); margin-bottom:0.5rem; text-transform:uppercase;">Senha</label>
                    <input type="password" id="login-password" required style="width:100%; padding:0.8rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px;" placeholder="••••••••">
                </div>
                <button type="submit" class="btn-primary" style="width:100%; justify-content:center; margin-top:1rem;">Entrar na Plataforma</button>
                <div style="text-align:center; margin-top:1.5rem;">
                    <button type="button" id="forgot-password-link" style="background:none; border:none; color:var(--gray-500); font-size:0.85rem; cursor:pointer; text-decoration:underline;">Esqueci minha senha</button>
                </div>
            </form>
            
            <div style="margin-top:2rem; text-align:center; font-size:0.9rem; border-top:1px solid var(--border); padding-top:1.5rem;">
                <p style="color:var(--gray-400); margin-bottom:0.5rem;">Novo por aqui? <a href="#" id="goto-register" style="color:var(--gray-100); font-weight:600; text-decoration:none;">Criar conta</a></p>
            </div>
        </div>
    `;

    document.getElementById('forgot-password-link').onclick = () => {
        const modalId = 'forgot-password-modal';
        if (document.getElementById(modalId)) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = modalId;
        modalDiv.className = 'modal-overlay';
        modalDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000; display:flex; align-items:center; justify-content:center;';
        
        modalDiv.innerHTML = `
            <div style="background:var(--gray-900); width:90%; max-width:400px; padding:2rem; border-radius:12px; border:1px solid var(--border); box-shadow:0 20px 50px rgba(0,0,0,0.5); animation: fade-in 0.3s ease-out;">
                <h3 style="font-size:1.15rem; color:var(--gray-100); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="key" style="color:var(--gray-400);"></i> Recuperar Senha</h3>
                <p style="font-size:0.85rem; color:var(--gray-400); margin-bottom:1.5rem;">Enviaremos um link oficial de redefinição para o seu e-mail cadastrado.</p>
                
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; font-size:0.75rem; color:var(--gray-500); margin-bottom:0.5rem; text-transform:uppercase;">E-mail Cadastrado</label>
                    <input type="email" id="reset-email-input" required style="width:100%; padding:0.8rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px; font-size:0.9rem;" placeholder="seu@email.com">
                </div>
                
                <div style="display:flex; gap:1rem;">
                    <button id="close-reset-modal" style="flex:1; padding:0.8rem; background:transparent; border:1px solid var(--border); color:var(--gray-400); border-radius:6px; cursor:pointer; font-weight:600;">Cancelar</button>
                    <button id="send-reset-link" class="btn-primary" style="flex:2; padding:0.8rem; font-weight:700;">Enviar Link</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalDiv);
        if (window.lucide) lucide.createIcons();

        document.getElementById('close-reset-modal').onclick = () => modalDiv.remove();
        
        document.getElementById('send-reset-link').onclick = async () => {
            const emailInput = document.getElementById('reset-email-input');
            const email = emailInput.value.trim();
            const btn = document.getElementById('send-reset-link');

            if (!email) {
                window.showAlert("Atenção", "Por favor, digite seu e-mail.", "info");
                return;
            }

            btn.disabled = true;
            btn.innerText = "Enviando...";

            const supabase = getSupabaseClient();
            if (!supabase) {
                window.showAlert("Erro", "O cliente Supabase não pôde ser inicializado.", "error");
                return;
            }

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/?view=account`
            });

            if (error) {
                window.showAlert("Erro de Envio", "Não conseguimos enviar o e-mail: " + error.message, "error");
                btn.disabled = false;
                btn.innerText = "Enviar Link";
            } else {
                window.showAlert("Sucesso!", "E-mail de recuperação enviado! Verifique sua caixa de entrada.", "success");
                modalDiv.remove();
            }
        };
    };

    document.getElementById('goto-register').onclick = (e) => {
        e.preventDefault();
        renderRegister(container, navigateFn);
    };

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = e.target.querySelector('button');
        
        submitBtn.disabled = true;
        submitBtn.innerText = "Verificando...";

        const supabase = getSupabaseClient();
        if (!supabase) {
            window.showAlert("Erro Sitema", "O cliente Supabase não foi inicializado.", "error");
            submitBtn.disabled = false;
            submitBtn.innerText = "Entrar na Plataforma";
            return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            window.showAlert("Falha no Login", error.message, "error");
            submitBtn.disabled = false;
            submitBtn.innerText = "Entrar no Simulai";
        } else {
            window.location.reload();
        }
    };
}

export function renderRegister(container, navigateFn) {
    container.innerHTML = `
        <div class="auth-container" style="max-width:450px; margin: 3rem auto; padding:2rem; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: fade-in 0.3s ease-out;">
            <div style="text-align:center; margin-bottom:2rem;">
                <h2 style="font-size:1.75rem; margin-bottom:0.5rem;">Ativar Acesso Simulai</h2>
                <p style="color:var(--gray-400); font-size:0.9rem;">Seu futuro no Ministério da Fazenda começa aqui.</p>
            </div>
            
            <form id="register-form" style="display:flex; flex-direction:column; gap:1rem;">
                <div class="form-group">
                    <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">Nome Completo</label>
                    <input type="text" id="reg-name" required style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px;">
                </div>
                <div class="form-group">
                    <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">E-mail</label>
                    <input type="email" id="reg-email" required style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px;">
                </div>
                <div class="form-group">
                    <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">Sua Senha</label>
                    <input type="password" id="reg-password" required minlength="6" style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px;">
                </div>
                <div class="form-group">
                    <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">Confirmar Senha</label>
                    <input type="password" id="reg-confirm" required style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); color:white; border-radius:6px;">
                </div>
                <button type="submit" class="btn-primary" style="padding:1rem; font-weight:600; margin-top:0.5rem;">Cadastrar e Verificar E-mail</button>
            </form>
            
            <div style="margin-top:2rem; text-align:center; font-size:0.9rem; border-top:1px solid var(--border); padding-top:1.5rem;">
                <p style="color:var(--gray-400);">Já faz parte da elite? <a href="#" id="goto-login" style="color:var(--gray-100); font-weight:600; text-decoration:none;">Fazer Login</a></p>
            </div>
        </div>
    `;

    document.getElementById('goto-login').onclick = (e) => {
        e.preventDefault();
        renderLogin(container, navigateFn);
    };

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (password !== confirm) {
            window.showAlert("Senhas Diferentes", "As senhas digitadas não coincidem. Tente novamente.", "warning");
            return;
        }

        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.innerText = "Processando...";

        const supabase = getSupabaseClient();
        if (!supabase) {
            window.showAlert("Erro", "Erro de inicialização do Supabase.", "error");
            submitBtn.disabled = false;
            submitBtn.innerText = "Cadastrar e Verificar E-mail";
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) {
            window.showAlert("Erro de Cadastro", error.message, "error");
            submitBtn.disabled = false;
            submitBtn.innerText = "Cadastrar e Verificar E-mail";
        } else {
            window.showAlert("Quase lá!", "Excelente! Verifique seu e-mail agora. Acabamos de enviar um link de ativação para você.", "success");
            renderLogin(container, navigateFn);
        }
    };
}

export async function renderAccount(container) {
    const user = await auth.getUser();
    if (!user) return renderLogin(container);

    container.innerHTML = `
        <div class="account-view" style="max-width:800px; margin: 0 auto; padding: 0 1.5rem; animation: fade-in 0.3s ease-out;">
            <div class="account-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem; margin-bottom:2.5rem; border-bottom:1px solid var(--border); padding-bottom:2rem;">
                <div>
                    <h2 style="font-size:2rem; margin-bottom:0.5rem;">Minha Conta</h2>
                    <p style="color:var(--gray-400);">Área de segurança e dados pessoais do seu perfil.</p>
                </div>
                <button onclick="window.simulaiLogout()" class="btn-secondary" style="color:var(--danger); border-color:var(--danger); white-space:nowrap;"><i data-lucide="log-out"></i> Sair do Simulai</button>
            </div>

            <div class="account-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem;">
                <div class="account-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:2rem;">
                    <h3 style="font-size:1.1rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="user"></i> Dados Pessoais</h3>
                    <form id="update-name-form" style="display:flex; flex-direction:column; gap:1.2rem;">
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">Seu Nome Completo</label>
                            <input type="text" id="new-name-input" value="${user.name}" required style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); border-radius:6px; color:white;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">E-mail (Permanente)</label>
                            <div style="font-size:1rem; padding:0.7rem; background:var(--gray-900); border:1px solid var(--border); border-radius:6px; color:var(--gray-400);">${user.email}</div>
                        </div>
                        <button type="submit" class="btn-primary" style="margin-top:0.5rem; width:100%;">Salvar Novo Nome</button>
                    </form>
                </div>

                <div class="account-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:2rem;">
                    <h3 style="font-size:1.1rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="lock"></i> Segurança</h3>
                    <form id="update-password-form" style="display:flex; flex-direction:column; gap:1.2rem;">
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">Nova Senha</label>
                            <input type="password" id="new-password-input" required minlength="6" placeholder="Mínimo 6 caracteres" style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); border-radius:6px; color:white;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.7rem; color:var(--gray-500); margin-bottom:0.4rem; text-transform:uppercase;">Confirmar Nova Senha</label>
                            <input type="password" id="confirm-password-input" required style="width:100%; padding:0.7rem; background:var(--gray-950); border:1px solid var(--border); border-radius:6px; color:white;">
                        </div>
                        <button type="submit" class="btn-secondary" style="margin-top:0.5rem; width:100%;">Atualizar Minha Senha</button>
                    </form>
                </div>

                <div class="account-card" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:2rem; grid-column: 1 / -1; border-top: 2px solid #ef4444;">
                    <h3 style="font-size:1.1rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="crown" style="color:#ef4444;"></i> Simulai Premium</h3>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1.5rem;">
                        <div style="flex:1; min-width:280px;">
                            <p style="color:var(--gray-300); font-size:0.95rem; margin-bottom:0.5rem;">Tenha acesso ilimitado a todos os simulados, explicações e catálogo de questões atualizado.</p>
                            <span style="font-size:0.75rem; color:var(--gray-500); text-transform:uppercase;">Escolha o Plano Ideal</span>
                        </div>
                        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                            <button class="stripe-checkout-btn btn-primary" data-price="price_1QwXXX_MONTHLY" style="background:var(--gray-800); border:1px solid var(--border); border-radius:8px; padding:0.8rem 1.5rem; font-weight:700;">
                                Mensal <br><span style="font-size:0.8rem; font-weight:normal; opacity:0.8;">R$ 37 /mês</span>
                            </button>
                            <button class="stripe-checkout-btn btn-primary" data-price="price_1QwXXX_ANNUAL" style="background:#ef4444; border:none; padding:0.8rem 1.5rem; border-radius:8px; font-weight:700;">
                                <i data-lucide="zap" style="margin-right:0.5rem;"></i> Anual <br><span style="font-size:0.8rem; font-weight:normal; opacity:0.8;">R$ 370 (2 meses grátis)</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    document.getElementById('update-name-form').onsubmit = async (e) => {
        e.preventDefault();
        const newName = document.getElementById('new-name-input').value;
        const submitBtn = e.target.querySelector('button');
        
        submitBtn.disabled = true;
        submitBtn.innerText = "Sincronizando...";

        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { error } = await supabase.auth.updateUser({
            data: { full_name: newName }
        });

        if (error) {
            window.showAlert("Erro", "Erro ao atualizar nome: " + error.message, "error");
            submitBtn.disabled = false;
            submitBtn.innerText = "Salvar Novo Nome";
        } else {
            window.showAlert("Sucesso", "Excelente! Nome atualizado com sucesso.", "success");
            window.location.reload();
        }
    };

    document.getElementById('update-password-form').onsubmit = async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password-input').value;
        const confirmPassword = document.getElementById('confirm-password-input').value;
        const submitBtn = e.target.querySelector('button');

        if (newPassword !== confirmPassword) {
            window.showAlert("Erro de Coincidência", "As senhas novas não coincidem!", "error");
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerText = "Atualizando senha...";

        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            window.showAlert("Falha na Atualização", error.message, "error");
            submitBtn.disabled = false;
            submitBtn.innerText = "Atualizar Minha Senha";
        } else {
            window.showAlert("Sucesso!", "Sua senha foi redefinida com segurança.", "success");
            e.target.reset();
            submitBtn.disabled = false;
            submitBtn.innerText = "Atualizar Minha Senha";
        }
    };

    // BOTÃO DE PAGAMENTO (STRIPE) MULTI
    container.querySelectorAll('.stripe-checkout-btn').forEach(checkoutBtn => {
        checkoutBtn.addEventListener('click', async () => {
            const user = await auth.getUser();
            if (!user) return;
            
            const originalHtml = checkoutBtn.innerHTML;
            const targetColor = checkoutBtn.style.background;
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = "Preparando acesso...";
            checkoutBtn.style.background = "var(--gray-700)";
            
            try {
                const response = await apiFetch(`/payment/create-checkout-session`, {
                    method: "POST",
                    body: JSON.stringify({ 
                        userId: user.id, 
                        email: user.email,
                        priceId: checkoutBtn.dataset.price,
                        origin: window.location.origin 
                    })
                });
                const session = await response.json();
                
                if (session.url) {
                    window.location.href = session.url;
                } else {
                    const errorMsg = session.error?.message || session.error || "Erro desconhecido";
                    window.showAlert("Falha no Pagamento", errorMsg, "error");
                    checkoutBtn.disabled = false;
                    checkoutBtn.innerHTML = originalHtml;
                    checkoutBtn.style.background = targetColor;
                }
            } catch (err) {
                window.showAlert("Erro de Conexão", "Não conseguimos conectar com o servidor do Stripe.", "error");
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = originalHtml;
                checkoutBtn.style.background = targetColor;
            }
        });
    });

    // Removido listener manual de logout para usar atributo onclick direto no HTML
}
