import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ============================================================
// CORS
// ============================================================
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));

// ============================================================
// GOD MODE — Bypass Total com Chave Mestre
// ============================================================
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const keyParams = url.searchParams.get('admin_key');
  const keyHeader = c.req.header('x-admin-key');
  
  if (keyParams === 'simulasupport2025' || keyHeader === 'simulasupport2025') {
    c.set('userId', 'MASTER_ADMIN');
    c.set('userEmail', 'simulaaihub@gmail.com');
    // Sincroniza Master Admin no Banco de Dados se não existir
    try {
      const db = c.env.meu_simulado_db;
      await db.prepare("INSERT OR IGNORE INTO Users_v2 (id, email, name, is_admin) VALUES ('MASTER_ADMIN', 'simulaaihub@gmail.com', 'Master Admin', 1)").run();
    } catch(e) {}
    return await next();
  }
  await next();
});

// ============================================================
// HELPERS
// ============================================================

const nanoid = () => crypto.randomUUID();

const parseOptions = (raw) => {
  try {
    if (!raw) return [];
    if (typeof raw === 'object') return raw; // already parsed if D1/Hono did something
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse options JSON:", raw);
    return [];
  }
};

const getDateBRT = () => {
  const now = new Date();
  // UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
};

const hashPassword = async (password, salt) => {
  const msgUint8 = new TextEncoder().encode(password + (salt || 'SIMULAI_DEFAULT_SALT'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const verifyStripeSignature = async (signature, rawBody, secret) => {
  if (!signature || !secret) return false;
  try {
    const parts = signature.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});
    const t = parts['t'];
    const v1 = parts['v1'];
    if (!t || !v1) return false;
    const signedPayload = `${t}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const hexSig = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hexSig === v1;
  } catch (e) { return false; }
};

const verifySupabaseJWT = async (token, secret) => {
  if (!token || !secret) return null;
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    // Verify HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${headerB64}.${payloadB64}`));
    if (!valid) return null;
    return payload;
  } catch (e) { return null; }
};

const sendEmail = async (to, subject, html, resendKey) => {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({ from: 'onboarding@resend.dev', to: [to], subject, html }),
    });
    return { ok: res.ok, body: await res.json() };
  } catch (err) { return { ok: false, error: err.message }; }
};

// ============================================================
// MIDDLEWARE — Autenticação JWT (Supabase)
// ============================================================
app.use('/api/*', async (c, next) => {
  // Ignora autenticação para preflight CORS (OPTIONS)
  if (c.req.method === 'OPTIONS') {
    return await next();
  }

  // Permite acesso público à lista de simulados na Home
  if (c.req.path.startsWith('/api/quizzes') && c.req.method === 'GET') {
    return await next();
  }

/* 
  // MIDDLEWARE GLOBAL DE AUTENTICAÇÃO (DESATIVADO TEMPORARIAMENTE PARA TESTE)
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return c.json({ error: 'Unauthorized: missing token' }, 401);

  const env = c.env;
  const payload = await verifySupabaseJWT(token, env.SUPABASE_JWT_SECRET);
  if (!payload) return c.json({ error: 'Unauthorized: invalid token' }, 401);

  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  */
  await next();
});

// Middleware de verificação de admin (via JWT e Banco de Dados D1)
const adminOnly = async (c, next) => {
  const userId = c.get('userId');
  
  // BYPASS MESTRE: Se for o MASTER_ADMIN, pula a verificação de banco
  if (userId === 'MASTER_ADMIN') {
    return await next();
  }

  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  
  const db = c.env.meu_simulado_db;
  const user = await db.prepare('SELECT is_admin FROM Users_v2 WHERE id = ?').bind(userId).first();
  
  if (!user || !user.is_admin) {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
  
  await next();
};

// ============================================================
// HELPER — Verifica assinatura ativa do usuário
// ============================================================
const hasActiveSubscription = async (db, userId) => {
  const now = Math.floor(Date.now() / 1000);
  const sub = await db.prepare(
    "SELECT id FROM Subscriptions WHERE user_id = ? AND status = 'active' AND current_period_end > ?"
  ).bind(userId, now).first();
  return !!sub;
};

// ============================================================
// ROTAS PÚBLICAS (sem JWT)
// ============================================================

// Health check
app.get('/', c => c.json({ status: 'Simulai API v2.0 🚀', timestamp: new Date().toISOString() }));

// ============================================================
// STRIPE WEBHOOK (público — sem JWT)
// ============================================================
app.post('/webhook/stripe', async (c) => {
  try {
    const signature = c.req.header('Stripe-Signature');
    const rawBody = await c.req.text();
    const env = c.env;

    const isValid = await verifyStripeSignature(signature, rawBody, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      console.error('[SEGURANÇA] Webhook com assinatura inválida recusado.');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(rawBody);
    const db = env.meu_simulado_db;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const subId = session.subscription;
      const customerEmail = session.customer_email;

      if (userId && subId) {
        // Busca detalhes da assinatura no Stripe
        const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
        });
        const stripeSub = await stripeRes.json();

        const plan = stripeSub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
        const periodEnd = stripeSub.current_period_end;

        // Idempotência: ignora se já existe
        await db.prepare(`
          INSERT OR REPLACE INTO Subscriptions (id, user_id, status, plan, stripe_subscription_id, current_period_end)
          VALUES (?, ?, 'active', ?, ?, ?)
        `).bind(nanoid(), userId, plan, subId, periodEnd).run();

        // Sincroniza usuário se não existir
        await db.prepare(`
          INSERT OR IGNORE INTO Users (id, email) VALUES (?, ?)
        `).bind(userId, customerEmail || '').run();

        console.log(`[PAGAMENTO] Assinatura ${plan} ativada para: ${customerEmail}`);
      }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object;
      await db.prepare(
        "UPDATE Subscriptions SET status = ?, current_period_end = ? WHERE stripe_subscription_id = ?"
      ).bind(stripeSub.status, stripeSub.current_period_end, stripeSub.id).run();
    }

    return c.json({ received: true });
  } catch (err) {
    console.error('Erro no Webhook:', err.message);
    return c.json({ error: err.message }, 400);
  }
});

// ============================================================
// AUTH — Supabase (sem JWT middleware pois usa próprio sistema)
// ============================================================

// Sincronizar usuário Supabase com D1 (chamado após login)
app.post('/auth/sync', async (c) => {
  try {
    const { id, email, name } = await c.req.json();
    await c.env.meu_simulado_db.prepare(
      "INSERT OR IGNORE INTO Users_v2 (id, email, name) VALUES (?, ?, ?)"
    ).bind(id, email, name || '').run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Verificar permissões (legado + assinatura)
app.post('/auth/permissions', async (c) => {
  try {
    const { userId } = await c.req.json();
    const db = c.env.meu_simulado_db;
    const isSubscriber = await hasActiveSubscription(db, userId);
    const { results } = await db.prepare(
      "SELECT content_id FROM UserPermissions WHERE user_id = ?"
    ).bind(userId).all();
    return c.json({
      success: true,
      is_subscriber: isSubscriber,
      permissions: results.map(r => r.content_id)
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================================
// PAGAMENTOS — Stripe
// ============================================================
app.post('/payment/create-checkout-session', async (c) => {
  try {
    const { userId, email, priceId, origin } = await c.req.json();
    const env = c.env;
    const frontendUrl = origin || 'http://localhost:5173';

    // Suporte a priceId explícito (mensal ou anual) ou fallback para mensal
    const priceParam = priceId || env.STRIPE_PRICE_MONTHLY;

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'success_url': `${frontendUrl}/?view=account&success=true`,
        'cancel_url': `${frontendUrl}/?view=account&canceled=true`,
        'line_items[0][price]': priceParam,
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'customer_email': email,
        'client_reference_id': userId,
        'payment_method_types[0]': 'card',
        'subscription_data[metadata][userId]': userId,
      })
    });

    const session = await stripeRes.json();
    return c.json(session);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// Rota legada — one-time (compatibilidade)
app.post('/payment/create-checkout-session-legacy', async (c) => {
  try {
    const { userId, email, origin } = await c.req.json();
    const env = c.env;
    const frontendUrl = origin || 'http://localhost:5173';

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'success_url': `${frontendUrl}/?view=account&success=true`,
        'cancel_url': `${frontendUrl}/?view=account&canceled=true`,
        'line_items[0][price_data][currency]': 'brl',
        'line_items[0][price_data][product_data][name]': 'Simulai Premium Vitalício',
        'line_items[0][price_data][unit_amount]': '9700',
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'customer_email': email,
        'client_reference_id': userId,
      })
    });

    const session = await stripeRes.json();
    return c.json(session);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================
// API — QUIZZES (feed dinâmico com controle de acesso)
// ============================================================
app.get('/api/quizzes', async (c) => {
  const userId = c.get('userId');
  const db = c.env.meu_simulado_db;
  const limit = parseInt(c.req.query('limit') || '20');
  const cursor = c.req.query('cursor'); // last quiz id

  try {
    const isSubscriber = await hasActiveSubscription(db, userId);

    // Busca uso diário do usuário
    const today = getDateBRT();
    const usage = await db.prepare(
      "SELECT free_questions_used FROM UserDailyUsage WHERE user_id = ? AND date = ?"
    ).bind(userId, today).first();
    const freeUsed = usage?.free_questions_used || 0;

    // Cursor pagination (Mostra todos os simulados cadastrados)
    let query = "SELECT * FROM Quizzes WHERE 1=1";
    const binds = [];
    if (cursor) {
      query += " AND rowid < (SELECT rowid FROM Quizzes WHERE id = ?)";
      binds.push(cursor);
    }
    query += " ORDER BY rowid DESC LIMIT ?";
    binds.push(limit + 1);

    const { results: quizzes } = await db.prepare(query).bind(...binds).all();

    const hasMore = quizzes.length > limit;
    const page = quizzes.slice(0, limit);

    // Para cada quiz, adiciona accessStatus e progresso do usuário
    const enriched = await Promise.all(page.map(async (quiz) => {
      let accessStatus;
      if (!quiz.is_premium) {
        accessStatus = 'unlocked';
      } else if (isSubscriber) {
        accessStatus = 'unlocked';
      } else if (freeUsed < 10) {
        accessStatus = 'free_trial_available';
        quiz.free_remaining = 10 - freeUsed;
      } else {
        accessStatus = 'locked';
      }

      // Progresso atual do usuário neste quiz
      const progress = await db.prepare(
        "SELECT current_question_index, score, completed FROM UserProgress WHERE user_id = ? AND quiz_id = ?"
      ).bind(userId, quiz.id).first();

      // Total de questões do quiz
      const countResult = await db.prepare(
        "SELECT COUNT(*) as total FROM Questions WHERE quiz_id = ?"
      ).bind(quiz.id).first();

      return {
        ...quiz,
        accessStatus,
        totalQuestions: countResult?.total || 0,
        userProgress: progress ? {
          currentQuestionIndex: progress.current_question_index,
          score: progress.score,
          completed: !!progress.completed,
        } : null
      };
    }));

    return c.json({
      success: true,
      quizzes: enriched,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      freeQuestionsUsed: freeUsed,
      freeQuestionsLimit: 10,
      isSubscriber,
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Buscar quiz específico (com questões)
app.get('/api/quizzes/:id', async (c) => {
  const userId = c.get('userId');
  const quizId = c.req.param('id');
  const db = c.env.meu_simulado_db;

  try {
    const quiz = await db.prepare("SELECT * FROM Quizzes WHERE id = ? AND is_active = 1").bind(quizId).first();
    if (!quiz) return c.json({ error: 'Quiz não encontrado' }, 404);

    const { results: questions } = await db.prepare(
      "SELECT * FROM Questions WHERE quiz_id = ? ORDER BY sort_order ASC"
    ).bind(quizId).all();

    return c.json({ success: true, quiz, questions });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================================
// API — QUIZ ENGINE
// ============================================================

// Iniciar ou retomar quiz
app.post('/api/quiz/start', async (c) => {
  let userId = c.get('userId');
  const { quizId } = await c.req.json();
  const db = c.env.meu_simulado_db;

  // Usuário anônimo: gera um ID de sessão estável baseado no IP + User-Agent
  // para que o progresso persista dentro da mesma sessão de navegação
  if (!userId) {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const ua = c.req.header('user-agent') || 'unknown';
    const raw = `GUEST_${ip}_${ua}`;
    const msgUint8 = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    userId = `GUEST_${hashHex.slice(0, 16)}`;
  }

  try {
    const quiz = await db.prepare("SELECT * FROM Quizzes WHERE id = ? AND is_active = 1").bind(quizId).first();
    if (!quiz) return c.json({ error: 'Quiz não encontrado' }, 404);

    const { restart } = await c.req.json();

    // Verificar acesso freemium (apenas quizzes premium)
    if (quiz.is_premium) {
      const isSubscriber = await hasActiveSubscription(db, userId);
      if (!isSubscriber) {
        const today = getDateBRT();
        const usage = await db.prepare(
          "SELECT free_questions_used FROM UserDailyUsage WHERE user_id = ? AND date = ?"
        ).bind(userId, today).first();
        const freeUsed = usage?.free_questions_used || 0;
        if (freeUsed >= 10) {
          return c.json({ error: 'PAYWALL', message: 'Limite diário de 10 questões gratuitas atingido.' }, 403);
        }
      }
    }

    // Garante que o usuário existe
    await db.prepare(
      "INSERT OR IGNORE INTO Users_v2 (id, email, name) VALUES (?, ?, ?)"
    ).bind(userId, '', '').run();

    // Busca progresso
    let progress = await db.prepare(
      "SELECT * FROM UserProgress WHERE user_id = ? AND quiz_id = ?"
    ).bind(userId, quizId).first();

    if (restart && progress) {
        await db.prepare(
            "UPDATE UserProgress SET current_question_index = 0, score = 0, answers = '[]', completed = 0 WHERE id = ?"
        ).bind(progress.id).run();
        progress = { ...progress, current_question_index: 0, score: 0, answers: '[]', completed: 0 };
    }

    if (!progress) {
      const progressId = nanoid();
      await db.prepare(
        "INSERT INTO UserProgress (id, user_id, quiz_id) VALUES (?, ?, ?)"
      ).bind(progressId, userId, quizId).run();
      progress = { id: progressId, user_id: userId, quiz_id: quizId, current_question_index: 0, score: 0, answers: '[]', completed: 0 };
    }

    // Busca questões
    const { results: questions } = await db.prepare(
      "SELECT id, question, options, discipline, banca, image_url FROM Questions WHERE quiz_id = ? ORDER BY sort_order ASC"
    ).bind(quizId).all();

    const idx = progress.current_question_index || 0;
    const currentQuestion = questions[idx] || null;

    return c.json({
      success: true,
      sessionId: progress.id,
      currentQuestionIndex: idx,
      totalQuestions: questions.length,
      score: progress.score,
      completed: !!progress.completed,
      currentQuestion: currentQuestion ? {
        ...currentQuestion,
        options: parseOptions(currentQuestion.options).map(o => ({ letra: o.letra, texto: o.texto })) // hide correct
      } : null,
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});


// Responder questão
app.post('/api/quiz/answer', async (c) => {
  let userId = c.get('userId');
  const { sessionId, questionId, selectedLetter } = await c.req.json();
  const db = c.env.meu_simulado_db;

  // Fallback para usuários anônimos (consistente com /api/quiz/start)
  if (!userId) {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const ua = c.req.header('user-agent') || 'unknown';
    const raw = `GUEST_${ip}_${ua}`;
    const msgUint8 = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    userId = `GUEST_${hashHex.slice(0, 16)}`;
  }


  try {
    const progress = await db.prepare(
      "SELECT * FROM UserProgress WHERE id = ? AND user_id = ?"
    ).bind(sessionId, userId).first();
    if (!progress) return c.json({ error: 'Sessão não encontrada' }, 404);
    if (progress.completed) return c.json({ error: 'Quiz já finalizado' }, 400);

    // Busca a questão com a resposta correta
    const qIdNum = parseInt(questionId);
    const finalQId = isNaN(qIdNum) ? questionId : qIdNum;
    const question = await db.prepare(
      "SELECT * FROM Questions WHERE id = ? AND quiz_id = ?"
    ).bind(finalQId, progress.quiz_id).first();
    if (!question) return c.json({ error: 'Questão não encontrada' }, 404);

    // Verifica o limite freemium
    const quiz = await db.prepare("SELECT is_premium FROM Quizzes WHERE id = ?").bind(progress.quiz_id).first();
    if (quiz?.is_premium) {
      const isSubscriber = await hasActiveSubscription(db, userId);
      if (!isSubscriber) {
        const today = getDateBRT();
        const usage = await db.prepare(
          "SELECT free_questions_used FROM UserDailyUsage WHERE user_id = ? AND date = ?"
        ).bind(userId, today).first();
        const freeUsed = usage?.free_questions_used || 0;
        if (freeUsed >= 10) {
          return c.json({ error: 'PAYWALL', message: 'Limite diário de 10 questões gratuitas atingido.' }, 403);
        }
        // Incrementa uso diário
        await db.prepare(`
          INSERT INTO UserDailyUsage (id, user_id, date, free_questions_used)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id, date)
          DO UPDATE SET free_questions_used = free_questions_used + 1
        `).bind(nanoid(), userId, today).run();
      }
    }

    const options = parseOptions(question.options);
    const correctOption = options.find(o => o.correta);
    const correctLetter = correctOption?.letra || question.answer;
    const isCorrect = selectedLetter === correctLetter;

    // Atualiza progresso
    const answers = JSON.parse(progress.answers || '[]');
    const existingIdx = answers.findIndex(a => a.questionId === questionId);
    const entry = { questionId, selectedLetter, correctLetter, isCorrect };
    if (existingIdx >= 0) { answers[existingIdx] = entry; }
    else { answers.push(entry); }

    const newScore = answers.filter(a => a.isCorrect).length;
    const newIndex = (progress.current_question_index || 0) + 1;

    // Busca próxima questão
    const { results: questions } = await db.prepare(
      "SELECT id, question, options, discipline, banca FROM Questions WHERE quiz_id = ? ORDER BY sort_order ASC"
    ).bind(progress.quiz_id).all();
    const nextQuestion = questions[newIndex] || null;

    await db.prepare(
      "UPDATE UserProgress SET current_question_index = ?, score = ?, answers = ? WHERE id = ?"
    ).bind(newIndex, newScore, JSON.stringify(answers), sessionId).run();

    return c.json({
      success: true,
      correct: isCorrect,
      correctLetter,
      explanation: question.explanation || '',
      pegadinha: question.pegadinha || '',
      nextQuestion: nextQuestion ? {
        ...nextQuestion,
        options: parseOptions(nextQuestion.options).map(o => ({ letra: o.letra, texto: o.texto }))
      } : null,
      currentQuestionIndex: newIndex,
      totalQuestions: questions.length,
      score: newScore,
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Finalizar quiz
app.post('/api/quiz/finish', async (c) => {
  const userId = c.get('userId');
  const { sessionId } = await c.req.json();
  const db = c.env.meu_simulado_db;

  try {
    const progress = await db.prepare(
      "SELECT * FROM UserProgress WHERE id = ? AND user_id = ?"
    ).bind(sessionId, userId).first();
    if (!progress) return c.json({ error: 'Sessão não encontrada' }, 404);

    const now = Math.floor(Date.now() / 1000);
    await db.prepare(
      "UPDATE UserProgress SET completed = 1, completed_at = ? WHERE id = ?"
    ).bind(now, sessionId).run();

    const answers = JSON.parse(progress.answers || '[]');
    const total = answers.length;
    const correct = answers.filter(a => a.isCorrect).length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return c.json({
      success: true,
      score: correct,
      total,
      percentage,
      answers,
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================================
// API — ADMIN: Gerenciar Quizzes + Questões
// ============================================================

// Rota de Migração — Garante que todas as tabelas existam e colunas estejam corretas
app.get('/api/admin/migrate/fix-db', adminOnly, async (c) => {
  try {
    const db = c.env.meu_simulado_db;
    
    // 1. Criar Tabelas se não existirem (Schema Seguro)
    await db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS Users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, phone TEXT, role TEXT DEFAULT 'user', stripe_customer_id TEXT, created_at INTEGER DEFAULT (unixepoch()))"),
      db.prepare("CREATE TABLE IF NOT EXISTS Subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES Users(id), status TEXT NOT NULL DEFAULT 'inactive', plan TEXT DEFAULT 'monthly', stripe_subscription_id TEXT UNIQUE, current_period_end INTEGER, created_at INTEGER DEFAULT (unixepoch()))"),
      db.prepare("CREATE TABLE IF NOT EXISTS Quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, subject TEXT, is_premium INTEGER DEFAULT 0, difficulty TEXT DEFAULT 'medium', is_active INTEGER DEFAULT 1, image_url TEXT, attachments TEXT, created_at INTEGER DEFAULT (unixepoch()))"),
      db.prepare("CREATE TABLE IF NOT EXISTS Questions (id TEXT PRIMARY KEY, quiz_id TEXT REFERENCES Quizzes(id), discipline TEXT, question TEXT NOT NULL, options TEXT NOT NULL, answer TEXT, explanation TEXT, banca TEXT DEFAULT 'ESAF', pegadinha TEXT, image_url TEXT, sort_order INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()))"),
      db.prepare("CREATE TABLE IF NOT EXISTS UserProgress (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES Users(id), quiz_id TEXT NOT NULL REFERENCES Quizzes(id), current_question_index INTEGER DEFAULT 0, score INTEGER DEFAULT 0, answers TEXT DEFAULT '[]', completed INTEGER DEFAULT 0, started_at INTEGER DEFAULT (unixepoch()), completed_at INTEGER, UNIQUE(user_id, quiz_id))"),
      db.prepare("CREATE TABLE IF NOT EXISTS UserDailyUsage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES Users(id), date TEXT NOT NULL, free_questions_used INTEGER DEFAULT 0, UNIQUE(user_id, date))")
    ]);

    // 2. Correção de Colunas (Migration Incremental)
    const questionsCols = await db.prepare("PRAGMA table_info(Questions)").all();
    const quizCols = await db.prepare("PRAGMA table_info(Quizzes)").all();
    
    const hasCol = (results, name) => results.some(c => c.name === name);

    if (!hasCol(questionsCols.results, 'quiz_id')) await db.prepare("ALTER TABLE Questions ADD COLUMN quiz_id TEXT REFERENCES Quizzes(id)").run();
    if (!hasCol(questionsCols.results, 'pegadinha')) await db.prepare("ALTER TABLE Questions ADD COLUMN pegadinha TEXT").run();
    if (!hasCol(questionsCols.results, 'image_url')) await db.prepare("ALTER TABLE Questions ADD COLUMN image_url TEXT").run();
    if (!hasCol(questionsCols.results, 'sort_order')) await db.prepare("ALTER TABLE Questions ADD COLUMN sort_order INTEGER DEFAULT 0").run();

    if (!hasCol(quizCols.results, 'image_url')) await db.prepare("ALTER TABLE Quizzes ADD COLUMN image_url TEXT").run();
    if (!hasCol(quizCols.results, 'attachments')) await db.prepare("ALTER TABLE Quizzes ADD COLUMN attachments TEXT").run();
    
    // Força ativação de ABSOLUTAMENTE TODOS os simulados
    await db.prepare("UPDATE Quizzes SET is_active = 1").run();

    return c.json({ success: true, message: "Banco de dados limpo e todos os simulados agora estão visíveis!" });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Listar todos os quizzes (admin)
app.get('/api/admin/quizzes', adminOnly, async (c) => {
  try {
    const { results } = await c.env.meu_simulado_db.prepare(
      "SELECT q.*, (SELECT COUNT(*) FROM Questions WHERE quiz_id = q.id) as question_count FROM Quizzes q ORDER BY q.created_at DESC"
    ).all();
    return c.json({ success: true, quizzes: results });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/admin/quizzes', adminOnly, async (c) => {
  try {
    const { title, description, subject, is_premium, difficulty, image_url, attachments } = await c.req.json();
    if (!title) return c.json({ success: false, error: 'Título é obrigatório' }, 400);
    
    const id = nanoid();
    await c.env.meu_simulado_db.prepare(
      "INSERT INTO Quizzes (id, title, description, subject, is_premium, difficulty, image_url, attachments, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, unixepoch())"
    ).bind(id, title, description || '', subject || 'Geral', is_premium ? 1 : 0, difficulty || 'medium', image_url || '', attachments || '').run();
    return c.json({ success: true, id });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Editar quiz
app.put('/api/admin/quizzes/:id', adminOnly, async (c) => {
  try {
    const id = c.req.param('id');
    const { title, description, subject, is_premium, difficulty, is_active, image_url, attachments } = await c.req.json();
    await c.env.meu_simulado_db.prepare(
      "UPDATE Quizzes SET title = ?, description = ?, subject = ?, is_premium = ?, difficulty = ?, is_active = ?, image_url = ?, attachments = ? WHERE id = ?"
    ).bind(title, description || '', subject || '', is_premium ? 1 : 0, difficulty || 'medium', is_active ? 1 : 0, image_url || '', attachments || '', id).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Deletar quiz
app.delete('/api/admin/quizzes/:id', adminOnly, async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.meu_simulado_db.prepare("DELETE FROM Questions WHERE quiz_id = ?").bind(id).run();
    await c.env.meu_simulado_db.prepare("DELETE FROM Quizzes WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Importar questões via CSV (bulk)
app.post('/api/admin/quizzes/:id/import', adminOnly, async (c) => {
  try {
    const quizId = c.req.param('id');
    const { csv } = await c.req.json();
    const db = c.env.meu_simulado_db;

    // Verifica se quiz existe
    const quiz = await db.prepare("SELECT id FROM Quizzes WHERE id = ?").bind(quizId).first();
    if (!quiz) return c.json({ error: 'Quiz não encontrado' }, 404);

    // Parse CSV Robusto (Suporta quebras de linha dentro de aspas)
    const lines = [];
    let currentLine = "";
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      if (char === '"') inQuotes = !inQuotes;
      if (char === '\n' && !inQuotes) {
        lines.push(currentLine.trim());
        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    if (lines.length < 2) return c.json({ success: false, error: 'CSV deve conter cabeçalho e ao menos uma linha de dados.' });

    // Detecção Automática de Separador (Vírgula ou Ponto-e-Vírgula)
    const firstLine = lines[0];
    const sep = firstLine.includes(';') ? ';' : ',';
    const header = firstLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1);

    console.log(`Importando ${rows.length} questões para quiz ${quizId}. Separador detectado: [${sep}]`);
    console.log(`Cabeçalhos detectados:`, header);

    let imported = 0;
    let errors = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const rowStr = rows[i];
        if (!rowStr) continue;

        // Regex para capturar colunas respeitando aspas e o separador (sep)
        const cols = [];
        let col = "";
        let inQ = false;
        for (let j = 0; j < rowStr.length; j++) {
          const c = rowStr[j];
          if (c === '"') inQ = !inQ;
          else if (c === sep && !inQ) {
            cols.push(col.trim().replace(/^"|"$/g, '')); // Remove aspas
            col = "";
          } else {
            col += c;
          }
        }
        cols.push(col.trim().replace(/^"|"$/g, '')); // Remove aspas da última coluna

        const row = {};
        header.forEach((h, idx) => { row[h] = cols[idx] || ''; });

        const correctRaw = (row['correct_answer'] || row['correta'] || '1').toString().trim();
        let correctIdx = parseInt(correctRaw) - 1;
        if (isNaN(correctIdx)) correctIdx = 0; // Default para a primeira se falhar

        const answerLetters = ['A', 'B', 'C', 'D', 'E'];
        
        const options = [
          { letra: 'A', texto: row['answer1'] || row['a'] || '', correta: correctIdx === 0 },
          { letra: 'B', texto: row['answer2'] || row['b'] || '', correta: correctIdx === 1 },
          { letra: 'C', texto: row['answer3'] || row['c'] || '', correta: correctIdx === 2 },
          { letra: 'D', texto: row['answer4'] || row['d'] || '', correta: correctIdx === 3 },
        ];

        const idValue = nanoid();
        try {
          await db.prepare(
            "INSERT INTO Questions (id, quiz_id, question, options, answer, explanation, discipline, banca, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            idValue, quizId,
            row['question_text'] || row['question'] || '',
            JSON.stringify(options),
            answerLetters[correctIdx] || 'A',
            row['explanation'] || row['explicacao'] || '',
            row['discipline'] || row['disciplina'] || '',
            row['banca'] || 'ESAF',
            imported
          ).run();
        } catch (dbErr) {
          if (dbErr.message.includes("datatype mismatch")) {
            await db.prepare(
              "INSERT INTO Questions (quiz_id, question, options, answer, explanation, discipline, banca, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              quizId,
              row['question_text'] || row['question'] || '',
              JSON.stringify(options),
              answerLetters[correctIdx] || 'A',
              row['explanation'] || row['explicacao'] || '',
              row['discipline'] || row['disciplina'] || '',
              row['banca'] || 'ESAF',
              imported
            ).run();
          } else {
            throw dbErr;
          }
        }
        imported++;
      } catch (rowErr) {
        errors.push({ row: i + 2, error: rowErr.message });
      }
    }

    return c.json({ success: true, imported, errors });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Listar questões de um quiz (admin)
app.get('/api/admin/quizzes/:id/questions', adminOnly, async (c) => {
  try {
    const quizId = c.req.param('id');
    const { results } = await c.env.meu_simulado_db.prepare(
      "SELECT * FROM Questions WHERE quiz_id = ? ORDER BY sort_order ASC"
    ).bind(quizId).all();
    return c.json({ success: true, questions: results });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Criar questão avulsa
app.post('/api/admin/questions', adminOnly, async (c) => {
  try {
    const q = await c.req.json();
    const db = c.env.meu_simulado_db;

    // Detecta se o ID deve ser texto ou se deve deixar o banco auto-incrementar
    let idValue = nanoid();
    
    try {
      await db.prepare(
        "INSERT INTO Questions (id, quiz_id, question, options, answer, explanation, discipline, banca, pegadinha, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        idValue, 
        q.quiz_id, 
        q.question, 
        q.options, 
        q.answer, 
        q.explanation || '', 
        q.discipline || '', 
        q.banca || 'ESAF', 
        q.pegadinha || '',
        0
      ).run();
      return c.json({ success: true, id: idValue });
    } catch (e) {
      // Fallback caso ID seja INTEGER (versões legadas onde nanoid não cabe no campo id ou o campo é auto-inc)
      if (e.message.includes("datatype mismatch")) {
        const res = await db.prepare(
          "INSERT INTO Questions (quiz_id, question, options, answer, explanation, discipline, banca, pegadinha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(q.quiz_id, q.question, q.options, q.answer, q.explanation || '', q.discipline || '', q.banca || 'ESAF', q.pegadinha || '').run();
        return c.json({ success: true, id: res.meta.last_row_id });
      }
      throw e;
    }
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Editar questão
app.put('/api/admin/questions/:id', adminOnly, async (c) => {
  try {
    const id = c.req.param('id');
    const q = await c.req.json();
    const idNum = parseInt(id);
    const finalId = isNaN(idNum) ? id : idNum;
    
    await c.env.meu_simulado_db.prepare(
      "UPDATE Questions SET question = ?, options = ?, answer = ?, explanation = ?, discipline = ?, banca = ?, pegadinha = ? WHERE id = ?"
    ).bind(q.question, q.options, q.answer, q.explanation || '', q.discipline || '', q.banca || 'ESAF', q.pegadinha || '', finalId).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Deletar questão
app.delete('/api/admin/questions/:id', adminOnly, async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.meu_simulado_db.prepare("DELETE FROM Questions WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Estatísticas Gerais (Admin Dashboard)
app.get('/api/admin/stats', adminOnly, async (c) => {
  try {
    const db = c.env.meu_simulado_db;
    const qCount = await db.prepare("SELECT COUNT(*) as total FROM Quizzes").first();
    const qsCount = await db.prepare("SELECT COUNT(*) as total FROM Questions").first();
    const uCount = await db.prepare("SELECT COUNT(*) as total FROM Users").first();
    const sCount = await db.prepare("SELECT COUNT(*) as total FROM Subscriptions WHERE status = 'active'").first();

    return c.json({
      success: true,
      stats: {
        quizzes: qCount?.total || 0,
        questions: qsCount?.total || 0,
        users: uCount?.total || 0,
        activeSubscriptions: sCount?.total || 0
      }
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Listar Usuários e Assinaturas (Admin)
app.get('/api/admin/users', adminOnly, async (c) => {
  try {
    const db = c.env.meu_simulado_db;
    const { results } = await db.prepare(`
      SELECT u.id, u.email, u.name, u.role,
             s.status as sub_status, s.plan as sub_plan, s.current_period_end
      FROM Users u
      LEFT JOIN Subscriptions s ON u.id = s.user_id
      ORDER BY u.rowid DESC
    `).all();
    return c.json({ success: true, users: results });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Analytics - Performance Global (Admin)
app.get('/api/admin/analytics', adminOnly, async (c) => {
  try {
    const db = c.env.meu_simulado_db;
    const sessions = await db.prepare("SELECT COUNT(*) as total FROM UserProgress WHERE completed = 1").first();
    const avgScore = await db.prepare("SELECT AVG(score) as avg FROM UserProgress WHERE completed = 1").first();
    
    // Top 5 simulados mais feitos
    const { results: topQuizzes } = await db.prepare(`
      SELECT q.title, COUNT(p.id) as completions
      FROM Quizzes q
      JOIN UserProgress p ON q.id = p.quiz_id
      WHERE p.completed = 1
      GROUP BY q.id
      ORDER BY completions DESC
      LIMIT 5
    `).all();

    return c.json({
      success: true,
      analytics: {
        totalCompletions: sessions?.total || 0,
        averageGlobalScore: Math.round(avgScore?.avg || 0),
        topQuizzes
      }
    });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================================
// ROTAS LEGADAS — compatibilidade com frontend atual
// ============================================================
app.get('/questoes', async (c) => {
  try {
    const { results } = await c.env.meu_simulado_db.prepare("SELECT * FROM Questions ORDER BY sort_order ASC").all();
    return c.json({ success: true, data: results });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ============================================================
// 404
// ============================================================
app.notFound(c => c.json({ error: 'Not Found' }, 404));

export default app;
