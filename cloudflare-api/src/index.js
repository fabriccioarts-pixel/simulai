export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    console.log(`[${request.method}] ${url.pathname}`);

    // Utilitário de Verificação de Admin
    const checkAdmin = (req) => {
        const key = req.headers.get("x-admin-key");
        return key === env.ADMIN_KEY;
    };

    // Utilitário de Envio de E-mail (Resend)
    const sendEmail = async (to, subject, html) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [to],
            subject: subject,
            html: html
          })
        });
        const resBody = await res.json();
        return { ok: res.ok, status: res.status, body: resBody };
      } catch (err) {
        console.error("Erro no envio:", err);
        return { ok: false, error: err.message };
      }
    };

    // Utilitário de Verificação de Assinatura do Stripe (Segurança Máxima)
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
        } catch(e) { return false; }
    };

    // Utilitário de Criptografia Segura
    const hashPassword = async (password) => {
      const msgUint8 = new TextEncoder().encode(password + (env.SIMULAI_SALT || "SIMULAI_DEFAULT_SALT"));
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    };

    // =============================================
    // STRIPE WEBHOOK HANDLER
    // =============================================
    if (url.pathname === "/payment/webhook" && request.method === "POST") {
        try {
            const signature = request.headers.get("Stripe-Signature");
            const rawBody = await request.text();
            
            const isValid = await verifyStripeSignature(signature, rawBody, env.STRIPE_WEBHOOK_SECRET);
            if (!isValid) {
                console.error("[SEGURANÇA] Webhook com assinatura inválida recusado.");
                return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
            }

            const event = JSON.parse(rawBody);
            
            if (event.type === "checkout.session.completed") {
                const session = event.data.object;
                const userId = session.client_reference_id;
                const email = session.customer_email;
                
                // O content_id "1" é o nosso Simulado Geral (ATA)
                const contentId = "1"; 

                if (userId) {
                    await env.meu_simulado_db.prepare(
                        "INSERT OR IGNORE INTO UserPermissions (user_id, content_id) VALUES (?, ?)"
                    ).bind(userId, contentId).run();
                    
                    console.log(`[PAGAMENTO] Acesso liberado para usuário: ${email}`);
                }
            }
            
            return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
        } catch (err) {
            console.error("Erro no Webhook:", err.message);
            return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
        }
    }

    // =============================================
    // STRIPE PAYMENT ROUTES
    // =============================================
    if (url.pathname === "/payment/create-checkout-session" && request.method === "POST") {
      try {
        const { userId, email, origin } = await request.json();
        const frontendUrl = origin || "http://localhost:5173";
        
        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            "success_url": `${frontendUrl}/?view=account&success=true`,
            "cancel_url": `${frontendUrl}/?view=account&canceled=true`,
            "line_items[0][price_data][currency]": "brl",
            "line_items[0][price_data][product_data][name]": "Simulai Premium Vitalício",
            "line_items[0][price_data][unit_amount]": "9700", // R$ 97,00
            "line_items[0][quantity]": "1",
            "mode": "payment",
            "customer_email": email,
            "client_reference_id": userId,
            "payment_method_types[0]": "card"
          })
        });

        const session = await stripeRes.json();
        return new Response(JSON.stringify(session), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- AUTH ENDPOINTS ---
    if (url.pathname === "/auth/signup" && request.method === "POST") {
      try {
        const { name, email, phone, password } = await request.json();
        
        if (password.length < 6) {
          return new Response(JSON.stringify({ success: false, error: "A senha deve ter no mínimo 6 caracteres." }), {
            status: 400, headers: corsHeaders
          });
        }

        const hashedPassword = await hashPassword(password);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        try {
          await env.meu_simulado_db.prepare(
            "INSERT INTO Users (name, email, phone, password, verification_code, is_verified) VALUES (?, ?, ?, ?, ?, 0)"
          ).bind(name, email, phone || "", hashedPassword, verificationCode).run();
        } catch (dbErr) {
          let msg = "Erro ao salvar no banco de dados";
          if (dbErr.message.includes("UNIQUE")) msg = "Este e-mail já está cadastrado";
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Se salvou no banco, tenta enviar o e-mail (mas não trava o cadastro se o e-mail falhar)
        const resendInfo = await sendEmail(
          email, 
          "Seu código de acesso: " + verificationCode, 
          `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h1 style="color: #111;">Ative sua conta no Simulai</h1>
            <p>Olá, <strong>${name}</strong>!</p>
            <p>Seu código exclusivo para acessar a plataforma é:</p>
            <div style="background: #f4f4f4; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; border: 1px solid #ddd;">
              ${verificationCode}
            </div>
            <p style="margin-top: 20px; color: #666; font-size: 14px;">Este código é válido por tempo limitado.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">Simulai - Hub de Elite Padrão ESAF</p>
          </div>
          `
        );

        return new Response(JSON.stringify({ 
          success: true, 
          message: resendInfo.ok ? "Usuário criado. Verifique seu e-mail." : "Usuário criado, mas houve um erro no envio do e-mail.",
          debug_code: !resendInfo.ok ? verificationCode : null, 
          email_error: !resendInfo.ok,
          resend_diag: resendInfo // Diagnóstico Técnico do Resend
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: "Dados inválidos: " + e.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/auth/verify" && request.method === "POST") {
      try {
        const { email, code } = await request.json();
        const user = await env.meu_simulado_db.prepare(
          "SELECT id FROM Users WHERE email = ? AND verification_code = ?"
        ).bind(email, code).first();

        if (user) {
          await env.meu_simulado_db.prepare("UPDATE Users SET is_verified = 1 WHERE id = ?").bind(user.id).run();
          return new Response(JSON.stringify({ success: true, message: "E-mail verificado!" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } else {
          return new Response(JSON.stringify({ success: false, error: "Código inválido" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/auth/login" && request.method === "POST") {
      try {
        const { email, password } = await request.json();
        const hashedPassword = await hashPassword(password);
        
        const user = await env.meu_simulado_db.prepare(
          "SELECT id, name, email, phone, created_at, is_verified, verification_code FROM Users WHERE email = ? AND password = ?"
        ).bind(email, hashedPassword).first();

        if (user) {
          if (user.is_verified === 0) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "PENDING_VERIFICATION", 
              email: user.email
            }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ success: true, user }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } else {
          return new Response(JSON.stringify({ success: false, error: "E-mail ou senha incorretos" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/auth/profile" && request.method === "POST") {
       try {
         const { id, name, phone } = await request.json();
         await env.meu_simulado_db.prepare("UPDATE Users SET name = ?, phone = ? WHERE id = ?").bind(name, phone, id).run();
         return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
       } catch(e) {
         return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
       }
    }
    if (url.pathname === "/auth/permissions" && request.method === "POST") {
       try {
         const { userId } = await request.json();
         const { results } = await env.meu_simulado_db.prepare(
           "SELECT content_id FROM UserPermissions WHERE user_id = ?"
         ).bind(userId).all();
         
         const contentIds = results.map(r => r.content_id);
         return new Response(JSON.stringify({ success: true, permissions: contentIds }), {
           headers: { ...corsHeaders, "Content-Type": "application/json" }
         });
       } catch (e) {
         return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
       }
    }

    // --- END AUTH ---

    if (url.pathname === "/questoes") {
      const contentId = url.searchParams.get("content_id") || "1";
      try {
        if (request.method === "GET") {
          const { results } = await env.meu_simulado_db.prepare("SELECT * FROM Questions WHERE content_id = ?").bind(contentId).all();
          return new Response(JSON.stringify({ success: true, data: results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } 
        
        if (request.method === "POST" || request.method === "PUT") {
          if (!checkAdmin(request)) {
             return new Response(JSON.stringify({ error: "Access Denied: Admin Key Required" }), { status: 401, headers: corsHeaders });
          }
          const q = await request.json();
          if (q.id && request.method === "PUT") {
             await env.meu_simulado_db.prepare(
                "UPDATE Questions SET original_id = ?, discipline = ?, question = ?, options = ?, answer = ?, explanation = ?, banca = ?, pegadinha = ?, content_id = ? WHERE id = ?"
             ).bind(q.original_id, q.discipline, q.question, q.options, q.answer, q.explanation, q.banca, q.pegadinha, q.content_id || contentId, q.id).run();
          } else {
             await env.meu_simulado_db.prepare(
                "INSERT INTO Questions (original_id, discipline, question, options, answer, explanation, banca, pegadinha, content_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
             ).bind(q.original_id, q.discipline, q.question, q.options, q.answer, q.explanation, q.banca, q.pegadinha, q.content_id || contentId).run();
          }
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    
    // Deletar Questão (Ex: /questoes/5)
    if (url.pathname.startsWith("/questoes/") && request.method === "DELETE" && url.pathname !== "/questoes/limpar") {
       if (!checkAdmin(request)) {
          return new Response(JSON.stringify({ error: "Access Denied" }), { status: 401, headers: corsHeaders });
       }
       try {
           const id = url.pathname.split("/").pop();
           await env.meu_simulado_db.prepare("DELETE FROM Questions WHERE id = ?").bind(id).run();
           return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
       } catch(e) {
           return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
       }
    }

    // Deletar TODAS as Questões de UM conteúdo (Massa)
    if (url.pathname === "/questoes/limpar" && request.method === "DELETE") {
       if (!checkAdmin(request)) {
          return new Response(JSON.stringify({ error: "Access Denied" }), { status: 401, headers: corsHeaders });
       }
       const contentId = url.searchParams.get("content_id") || "1";
       try {
           await env.meu_simulado_db.prepare("DELETE FROM Questions WHERE content_id = ?").bind(contentId).run();
           return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
       } catch(e) {
           return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
       }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
