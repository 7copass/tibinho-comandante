# Painel de tags e pixels — desenho

Data: 2026-10-05

## Problema

O site é um `index.html` estático na Vercel. Hoje, cada pixel novo exige editar
o HTML e dar push. Quem cuida do tráfego não mexe em código, então depende de
um desenvolvedor para qualquer teste de anúncio.

## Objetivo

Um painel com senha onde o gestor de tráfego cadastra tags e pixels sozinho,
com a identidade visual do site.

## Decisões

**Armazenamento: o próprio repositório.** O painel grava `tags.js` no GitHub
pela API, e a Vercel republica sozinha. Sem banco de dados e sem serviço novo.
O histórico fica no Git, o que dá auditoria e rollback de graça. Custo: a
mudança leva cerca de 40 segundos para aparecer no site.

Descartado: banco de dados (Supabase), porque o pixel só dispararia depois de
uma consulta, e visitante que sai rápido não seria contado. Descartado também
Edge Config da Vercel, por ser a opção mais difícil de o dono do projeto mexer
sozinho depois.

**Formato do cadastro: campos prontos e código livre.** Campos de ID para as
redes principais, onde o painel monta o script correto, mais uma área de código
livre para ferramentas não previstas.

**Autenticação: senha única em variável de ambiente.** Conferida no servidor. O
painel recebe só um token de sessão assinado com HMAC, válido por 8 horas.
Limitação aceita: quem tem a senha consegue rodar qualquer script no site, pela
própria natureza da área de código livre. Mitigação: trocar a senha quando
alguém sair do projeto, e o histórico do Git para desfazer.

**Tags existentes ficam fixas no HTML.** O GA4 `G-731D1FZLCT`, o Google Ads
`AW-18369974279` e o evento `whatsapp_click` continuam no `index.html`, como
hoje. O painel não mexe neles, para não arriscar perder medição. O gerador
ignora esses dois IDs se forem cadastrados de novo, evitando contagem dobrada.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `admin.html` | Tela de senha e formulário. Lê o estado atual de `tags.js`. |
| `api/_lib.js` | Lógica pura: senha, token, validação de IDs, geração do `tags.js`. |
| `api/login.js` | Confere a senha, devolve o cookie de sessão. |
| `api/salvar.js` | Valida a sessão e grava `tags.js` no GitHub. |
| `tags.js` | Arquivo gerado. Guarda a configuração e injeta as tags. |
| `vercel.json` | Exceções de rota para `/admin` e `/api`. |

O `tags.js` carrega em dois modos: no site ele injeta as tags; no painel, que
define `window.TIBINHO_TAGS_NO_INJECT`, ele só expõe a configuração para
preencher o formulário.

## Variáveis de ambiente (Vercel)

- `ADMIN_PASSWORD` — senha do painel. Também é a base da chave de assinatura da
  sessão, então trocá-la invalida as sessões abertas.
- `GITHUB_TOKEN` — token com permissão de escrita no repositório.
- `GITHUB_REPO` — opcional, padrão `7copass/tibinho-comandante`.

## Testes

Automatizados (`node --test`) na lógica de `api/_lib.js`: senha errada
recusada, token vencido recusado, token adulterado recusado, IDs em formato
inválido recusados, IDs fixos do site ignorados, script correto gerado por
rede.

Manual no navegador: entrar no painel, cadastrar um pixel de teste e confirmar
que ele dispara no site publicado.
