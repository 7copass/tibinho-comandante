'use strict';

const { senhaConfere, criarToken, DURACAO_SESSAO_MS } = require('./_lib.js');

// Contagem de tentativas por IP. Vive só na memória da instância, então não é
// uma barreira forte — serve para atrasar quem fica chutando senha.
const tentativas = new Map();
const LIMITE = 8;
const JANELA_MS = 10 * 60 * 1000;

function registrarTentativa(ip, agora) {
  const atual = tentativas.get(ip);
  if (!atual || agora - atual.desde > JANELA_MS) {
    tentativas.set(ip, { contador: 1, desde: agora });
    return 1;
  }
  atual.contador += 1;
  return atual.contador;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const senhaConfigurada = process.env.ADMIN_PASSWORD;
  if (!senhaConfigurada) {
    res.status(500).json({
      erro: 'O painel ainda não tem senha configurada. Defina ADMIN_PASSWORD nas variáveis de ambiente da Vercel.'
    });
    return;
  }

  const agora = Date.now();
  const ip = String(req.headers['x-forwarded-for'] || 'desconhecido').split(',')[0].trim();

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';

  if (registrarTentativa(ip, agora) > LIMITE) {
    res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    return;
  }

  if (!senhaConfere(senha, senhaConfigurada)) {
    // Atraso de propósito, para encarecer tentativa automatizada.
    await new Promise(r => setTimeout(r, 700));
    res.status(401).json({ erro: 'Senha incorreta.' });
    return;
  }

  tentativas.delete(ip);
  const token = criarToken(senhaConfigurada, agora);

  res.setHeader('Set-Cookie', [
    `painel=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${Math.floor(DURACAO_SESSAO_MS / 1000)}`
  ].join('; '));
  res.status(200).json({ ok: true, expira_em: new Date(agora + DURACAO_SESSAO_MS).toISOString() });
};
