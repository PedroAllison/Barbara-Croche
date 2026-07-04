# 🚀 Guia de publicação — Barbara Crochê (Vercel + Supabase)

Este guia coloca o sistema **online**, com o **painel admin funcionando como aplicativo** (dá pra instalar no celular e no PC) e acessível **de qualquer lugar** com a conta de admin.

Você vai usar **3 serviços gratuitos**:
- **Supabase** → banco de dados + fotos.
- **GitHub** → guarda o código (a Vercel publica a partir dele).
- **Vercel** → hospeda o site.

E, no final, um **domínio próprio** (ex.: `barbaracroche.com.br`) para a URL não ter `vercel.app`.

> ⏱️ Tempo estimado: 30–45 min na primeira vez. Faça com calma, na ordem.

---

## Parte 1 — Supabase (banco + fotos)

1. Crie uma conta em **https://supabase.com** e clique em **New project**.
2. Dê um nome (ex.: `barbara-croche`), crie uma **senha do banco** e **anote essa senha**. Em "Region", escolha **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1–2 min).

### 1.1 Criar as tabelas
4. No menu lateral, abra **SQL Editor** → **New query**.
5. Abra o arquivo **`supabase/schema.sql`** (está na pasta do projeto), copie **todo** o conteúdo, cole ali e clique em **Run**. Deve aparecer "Success".

### 1.2 Criar o "depósito" das fotos (Storage)
6. No menu, abra **Storage** → **New bucket**.
7. Nome do bucket: **`barbara`** (exatamente assim, minúsculo).
8. Marque a opção **Public bucket** (precisa ser público para as fotos aparecerem) e crie.

### 1.3 Pegar as chaves (vai usar na Parte 3)
9. Abra **Project Settings** (engrenagem) → **API**. Anote:
   - **Project URL** → será o `SUPABASE_URL`.
   - **service_role** (em "Project API keys", clique em "Reveal") → será o `SUPABASE_SERVICE_ROLE_KEY`. ⚠️ É secreta, não compartilhe.
10. Abra **Project Settings** → **Database** → seção **Connection string** → aba **Transaction pooler** (porta **6543**). Copie a string. Ela fica parecida com:
    ```
    postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
    ```
    Troque `[YOUR-PASSWORD]` pela **senha do banco** (passo 2) e **acrescente** `?sslmode=require` no final. Isso será o `DATABASE_URL`.

---

## Parte 2 — Subir o código no GitHub

1. Crie uma conta em **https://github.com**.
2. Instale o **GitHub Desktop** (https://desktop.github.com) — é o jeito mais fácil sem terminal.
3. Em GitHub Desktop: **File → Add local repository** e selecione a pasta do projeto
   (`...\ARKTECH SYSTEMS\Barbara Croche`). Se pedir, clique em **create a repository**.
4. Marque como **Private** e clique em **Publish repository**.

> O arquivo `.gitignore` já garante que o `.env` (senhas) **não** vá para o GitHub. ✅

---

## Parte 3 — Vercel (publicar o site)

1. Crie uma conta em **https://vercel.com** entrando **com o GitHub** (botão "Continue with GitHub").
2. Clique em **Add New… → Project** e **importe** o repositório `Barbara Croche`.
3. Em **Framework Preset**, deixe **Other**. Não precisa configurar build.
4. Abra **Environment Variables** e cadastre estas 6 (uma a uma):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | a string do passo 1.10 (com a senha e `?sslmode=require`) |
   | `SUPABASE_URL` | o Project URL (passo 1.9) |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role (passo 1.9) |
   | `SUPABASE_BUCKET` | `barbara` |
   | `ADMIN_USER` | o usuário de admin que você quiser (ex.: `barbara`) |
   | `ADMIN_PASSWORD` | uma senha forte que você escolher |
   | `JWT_SECRET` | um texto bem grande e aleatório (qualquer coisa longa) |

5. Clique em **Deploy** e aguarde (1–2 min). No fim aparece o endereço, algo como
   `https://barbara-croche.vercel.app`.
6. Teste:
   - Loja: `https://...vercel.app/`
   - Painel: `https://...vercel.app/admin` → entre com o `ADMIN_USER` / `ADMIN_PASSWORD`.

> Sempre que você atualizar o código no GitHub Desktop (botão **Push origin**), a Vercel publica a nova versão sozinha.

---

## Parte 4 — Domínio próprio (tirar o "vercel.app")

1. Registre um domínio. Para `.com.br`, use o **https://registro.br** (custo ~R$40/ano).
   Para `.com`, pode usar registro.br também ou outro registrador.
2. Na Vercel, abra seu projeto → **Settings → Domains → Add** e digite seu domínio
   (ex.: `barbaracroche.com.br`).
3. A Vercel vai mostrar os registros de DNS para configurar. No painel do **registro.br**,
   em **DNS**, adicione o que a Vercel pedir (geralmente um registro **A** para `@` apontando
   para o IP da Vercel e um **CNAME** para `www`).
4. Aguarde a propagação (pode levar de minutos a algumas horas). Quando ficar "Valid",
   seu site abre no domínio próprio, com cadeado (HTTPS) automático. ✅

Depois disso:
- Loja: `https://barbaracroche.com.br/`
- Painel: `https://barbaracroche.com.br/admin`

---

## Parte 5 — Instalar o painel como APP 📱💻

Com o site online, o painel pode ser "instalado" como aplicativo:

- **No celular (Android/Chrome):** abra `.../admin`, toque no menu do navegador → **Instalar app** / **Adicionar à tela inicial**.
- **No iPhone (Safari):** abra `.../admin`, toque em **Compartilhar** → **Adicionar à Tela de Início**.
- **No PC (Chrome/Edge):** abra `.../admin`, clique no ícone de **instalar** na barra de endereço.

Vai virar um ícone igual a um app, abrindo em tela cheia. A conta de admin é a mesma em todos os aparelhos, e os dados ficam sincronizados (tudo no Supabase).

---

## Primeiro acesso e segurança

- Entre no painel com `ADMIN_USER` / `ADMIN_PASSWORD` (as que você cadastrou na Vercel).
- Em **Configurações**, preencha os dados da loja, WhatsApp e o frete por região.
- Você pode **trocar a senha** dentro do painel (Configurações → Acesso ao painel). A senha nova passa a valer no lugar da variável.

---

## Rodar localmente para testar (opcional)

Se quiser testar no seu PC antes/depois de publicar:
1. Copie o arquivo `.env.example` para `.env` e preencha com os mesmos valores.
2. Tenha o Node.js instalado e rode:
   ```bash
   npm install
   npm start
   ```
3. Abra `http://localhost:3000/admin`. (Ele usa o mesmo banco do Supabase.)

---

## Problemas comuns

- **Painel abre mas dá erro ao logar / salvar:** confira as variáveis na Vercel (principalmente `DATABASE_URL` com a senha certa e `?sslmode=require`). Depois de mudar variáveis, clique em **Redeploy**.
- **Foto não aparece:** confirme que o bucket `barbara` é **Public** e que `SUPABASE_BUCKET=barbara`.
- **"relation does not exist":** você esqueceu de rodar o `supabase/schema.sql` (Parte 1.1).
- **Domínio não valida:** os registros de DNS podem demorar a propagar; aguarde e recarregue a tela de Domains na Vercel.

> Qualquer erro, me mande a mensagem que aparecer (em **Vercel → seu projeto → Logs**) que eu te ajudo a resolver.
