'use strict';

const { tokenValido, validarConfig, gerarTagsJs } = require('./_lib.js');

const CAMINHO = 'tags.js';
const REPO_PADRAO = '7copass/tibinho-comandante';

function lerCookie(req, nome) {
  const cru = req.headers.cookie || '';
  for (const parte of cru.split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return resto.join('=');
  }
  return '';
}

async function github(caminho, token, opcoes = {}) {
  const resposta = await fetch(`https://api.github.com${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'painel-tibinho',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const corpo = await resposta.json().catch(() => ({}));
  return { ok: resposta.ok, status: resposta.status, corpo };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const senhaConfigurada = process.env.ADMIN_PASSWORD;
  const tokenGithub = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || REPO_PADRAO;

  if (!senhaConfigurada || !tokenGithub) {
    res.status(500).json({
      erro: 'Faltam variáveis de ambiente na Vercel: ADMIN_PASSWORD e GITHUB_TOKEN.'
    });
    return;
  }

  if (!tokenValido(lerCookie(req, 'painel'), senhaConfigurada)) {
    res.status(401).json({ erro: 'Sessão expirada. Entre no painel de novo.' });
    return;
  }

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { config, erros, avisos } = validarConfig(corpo);
  if (erros.length > 0) {
    res.status(400).json({ erro: 'Confira os campos marcados.', erros });
    return;
  }

  const agora = new Date().toISOString();
  const conteudo = gerarTagsJs(config, agora);

  // O GitHub exige o sha da versão atual para sobrescrever um arquivo.
  const atual = await github(`/repos/${repo}/contents/${CAMINHO}`, tokenGithub);
  if (!atual.ok && atual.status !== 404) {
    res.status(502).json({
      erro: `Não consegui ler o ${CAMINHO} no GitHub (${atual.status}). Confira o GITHUB_TOKEN.`
    });
    return;
  }

  const gravacao = await github(`/repos/${repo}/contents/${CAMINHO}`, tokenGithub, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Atualiza tags e pixels pelo painel admin',
      content: Buffer.from(conteudo, 'utf8').toString('base64'),
      ...(atual.ok && atual.corpo.sha ? { sha: atual.corpo.sha } : {})
    })
  });

  if (!gravacao.ok) {
    const detalhe = gravacao.corpo && gravacao.corpo.message ? ` ${gravacao.corpo.message}` : '';
    res.status(502).json({
      erro: `O GitHub recusou a gravação (${gravacao.status}).${detalhe}`
    });
    return;
  }

  res.status(200).json({
    ok: true,
    avisos,
    atualizado_em: agora,
    commit: gravacao.corpo.commit ? gravacao.corpo.commit.html_url : null
  });
};
