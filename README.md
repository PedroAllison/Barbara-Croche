# Barbara Crochê — Sistema de Estoque + Loja (versão nuvem)

Sistema da loja em duas partes que compartilham o mesmo banco na nuvem:

1. **Painel gerencial** (app instalável) — estoque, produtos, financeiro e notas fiscais.
2. **Loja online** (site público) — catálogo, frete e contato com o vendedor (sem pagamento no site).

Tudo fica no **Supabase** (banco + fotos) e é publicado na **Vercel**. Assim a conta oficial de **admin acessa de qualquer lugar**, no celular ou no PC, e os dados ficam sempre sincronizados.

> Feito por **ARKTECH SYSTEMS** · Node.js + Express + Supabase (Postgres) · publicado na Vercel.

---

## 🚀 Como publicar

O passo a passo completo (Supabase → GitHub → Vercel → domínio próprio) está em **[`DEPLOY.md`](DEPLOY.md)**. Siga na ordem.

Resumo do que você vai precisar:
- Conta no **Supabase**, **GitHub** e **Vercel** (todas grátis).
- Rodar o arquivo **`supabase/schema.sql`** no Supabase (cria as tabelas).
- Criar um bucket **público** chamado `barbara` (guarda as fotos).
- Cadastrar as variáveis de ambiente na Vercel (ver `.env.example`).
- Registrar um **domínio próprio** (ex.: `barbaracroche.com.br`) para tirar o `vercel.app` da URL.

---

## 📱 Painel como aplicativo (PWA)

Depois de publicado, abra `.../admin` e use **Instalar app** (Chrome/Edge no PC e Android) ou **Adicionar à Tela de Início** (iPhone/Safari). O painel abre em tela cheia, como um app. Mesma conta de admin em todos os aparelhos.

---

## 🔑 Acesso do painel

O usuário e a senha são definidos nas variáveis `ADMIN_USER` e `ADMIN_PASSWORD` (na Vercel). Você pode trocar a senha dentro do painel em **Configurações → Acesso ao painel**.

---

## 📋 O que o sistema faz

**Painel:** dashboard (caixa, faturamento, valor em estoque, estoque baixo); produtos com **foto, descrição, cor, categoria, custo, venda, quantidade** e botões **salvar/editar/excluir/postar**; **entrada e baixa** de estoque; **financeiro** (caixa para compra e faturamento); **notas fiscais** (imagem/PDF); **mensagens** dos clientes; **configurações** (loja, contato, frete).

**Loja:** catálogo dos produtos **postados**, página do produto com estoque e preço, **cálculo de frete por CEP**, contato por WhatsApp e conta opcional (só para enviar mensagem). Sem pagamento no site.

---

## 🗂️ Estrutura

```
Barbara Croche/
├── DEPLOY.md              ← guia de publicação (comece por aqui)
├── .env.example           ← modelo das variáveis de ambiente
├── vercel.json            ← configuração da Vercel
├── api/index.js           ← ponto de entrada na Vercel (usa o app Express)
├── server.js              ← servidor local (para testar no PC)
├── src/
│   ├── app.js             ← app Express (rotas + estáticos)
│   ├── database.js        ← conexão Postgres (Supabase)
│   ├── auth.js            ← login por JWT (admin e clientes)
│   ├── storage.js         ← upload de fotos/notas (Supabase Storage)
│   └── routes/            ← admin.js (painel) e store.js (loja)
├── supabase/schema.sql    ← cria as tabelas no Supabase
├── index.html, produto.html, css/, js/   ← loja (site público)
└── admin/                 ← painel (app instalável: manifest, sw, ícones)
```

---

## 🧪 Rodar localmente (opcional)

1. Copie `.env.example` para `.env` e preencha (mesmos valores do Supabase).
2. `npm install` e depois `npm start`.
3. Abra `http://localhost:3000/admin` (usa o mesmo banco do Supabase).

---

## 🔒 Segurança

As senhas e chaves ficam **só nas variáveis de ambiente** (Supabase/Vercel), nunca no código. O `.gitignore` impede que o `.env` vá para o GitHub. Login com senha criptografada (bcrypt) e sessão por token assinado (JWT).
