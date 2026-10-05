'use strict';

// Lógica pura do painel de tags. Sem acesso a rede e sem estado, para poder
// ser testada direto com `node --test tests/`.

const crypto = require('crypto');

const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;

// Tags que já estão fixas no index.html. Se alguém cadastrar uma delas no
// painel, o site passaria a contar o mesmo acesso duas vezes.
const IDS_FIXOS = ['G-731D1FZLCT', 'AW-18369974279'];

const CAMPOS = {
  ga4: {
    rotulo: 'Google Analytics 4',
    formato: /^G-[A-Z0-9]{4,20}$/i,
    exemplo: 'G-ABC1234XYZ',
    script: id => `
  carregarScript('https://www.googletagmanager.com/gtag/js?id=${id}');
  gtag('js', new Date());
  gtag('config', '${id}');`
  },
  google_ads: {
    rotulo: 'Google Ads',
    formato: /^AW-[0-9]{6,20}$/i,
    exemplo: 'AW-123456789',
    script: id => `
  carregarScript('https://www.googletagmanager.com/gtag/js?id=${id}');
  gtag('js', new Date());
  gtag('config', '${id}');`
  },
  gtm: {
    rotulo: 'Google Tag Manager',
    formato: /^GTM-[A-Z0-9]{4,20}$/i,
    exemplo: 'GTM-ABC1234',
    script: id => `
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  carregarScript('https://www.googletagmanager.com/gtm.js?id=${id}');`
  },
  meta_pixel: {
    rotulo: 'Pixel do Meta (Facebook e Instagram)',
    formato: /^[0-9]{10,20}$/,
    exemplo: '1234567890123',
    script: id => `
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = true; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${id}');
  fbq('track', 'PageView');`
  },
  tiktok: {
    rotulo: 'TikTok',
    formato: /^[A-Z0-9]{10,30}$/i,
    exemplo: 'CABCDE12345FGHIJ',
    script: id => `
  (function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = w[t] = w[t] || [];
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
      'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function (obj, m) {
      obj[m] = function () { obj.push([m].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (id) {
      var inst = ttq._i[id] || [];
      for (var j = 0; j < ttq.methods.length; j++) ttq.setAndDefer(inst, ttq.methods[j]);
      return inst;
    };
    ttq.load = function (id, opt) {
      var url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url;
      ttq._t = ttq._t || {}; ttq._t[id] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[id] = opt || {};
      carregarScript(url + '?sdkid=' + id + '&lib=' + t);
    };
    ttq.load('${id}');
    ttq.page();
  })(window, document, 'ttq');`
  },
  linkedin: {
    rotulo: 'LinkedIn',
    formato: /^[0-9]{4,15}$/,
    exemplo: '1234567',
    script: id => `
  window._linkedin_partner_id = '${id}';
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push('${id}');
  window.lintrk = window.lintrk || function (a, b) { window.lintrk.q.push([a, b]); };
  window.lintrk.q = window.lintrk.q || [];
  carregarScript('https://snap.licdn.com/li.lms-analytics/insight.min.js');`
  },
  pinterest: {
    rotulo: 'Pinterest',
    formato: /^[0-9]{10,20}$/,
    exemplo: '2612345678901',
    script: id => `
  window.pintrk = window.pintrk || function () {
    window.pintrk.queue.push(Array.prototype.slice.call(arguments));
  };
  window.pintrk.queue = window.pintrk.queue || [];
  window.pintrk.version = '3.0';
  carregarScript('https://s.pinimg.com/ct/core.js');
  pintrk('load', '${id}');
  pintrk('page');`
  },
  kwai: {
    rotulo: 'Kwai',
    formato: /^[A-Z0-9]{4,30}$/i,
    exemplo: 'abc123',
    script: id => `
  window.kwaiq = window.kwaiq || [];
  window.kwaiq.methods = ['page', 'track', 'identify', 'instance', 'load'];
  window.kwaiq.load = function (id) { window.kwaiq.push(['load', id]); };
  carregarScript('https://s.kwai.net/kos/s101/nlav11187/pixel/events.js');
  window.kwaiq.load('${id}');
  window.kwaiq.push(['page']);`
  }
};

/**
 * Compara a senha enviada com a configurada em tempo constante, para não
 * entregar o tamanho nem o prefixo da senha a quem fica medindo a resposta.
 */
function senhaConfere(enviada, configurada) {
  if (typeof enviada !== 'string' || typeof configurada !== 'string') return false;
  if (enviada.length === 0 || configurada.length === 0) return false;
  const a = crypto.createHash('sha256').update(enviada).digest();
  const b = crypto.createHash('sha256').update(configurada).digest();
  return crypto.timingSafeEqual(a, b);
}

// A chave de assinatura nasce da senha: trocar a senha derruba as sessões abertas.
function chaveSessao(senha) {
  return crypto.createHash('sha256').update('sessao:' + senha).digest();
}

function assinar(corpo, senha) {
  return crypto.createHmac('sha256', chaveSessao(senha)).update(corpo).digest('base64url');
}

function criarToken(senha, agora = Date.now()) {
  const corpo = Buffer.from(JSON.stringify({ exp: agora + DURACAO_SESSAO_MS })).toString('base64url');
  return `${corpo}.${assinar(corpo, senha)}`;
}

function tokenValido(token, senha, agora = Date.now()) {
  if (typeof token !== 'string' || typeof senha !== 'string' || senha.length === 0) return false;
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return false;
  const [corpo, assinatura] = partes;

  const esperada = Buffer.from(assinar(corpo, senha));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length) return false;
  if (!crypto.timingSafeEqual(esperada, recebida)) return false;

  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    return typeof dados.exp === 'number' && agora < dados.exp;
  } catch {
    return false;
  }
}

/**
 * Confere o formato de cada ID e devolve a configuração limpa.
 * Retorna { config, erros, avisos } — erros impedem salvar, avisos não.
 */
function validarConfig(entrada) {
  const dados = entrada && typeof entrada === 'object' ? entrada : {};
  const config = {};
  const erros = [];
  const avisos = [];

  for (const [campo, def] of Object.entries(CAMPOS)) {
    const valor = String(dados[campo] ?? '').trim();
    if (valor === '') {
      config[campo] = '';
      continue;
    }
    if (!def.formato.test(valor)) {
      config[campo] = '';
      erros.push({
        campo,
        mensagem: `${def.rotulo}: formato inválido. O esperado é algo como ${def.exemplo}.`
      });
      continue;
    }
    if (IDS_FIXOS.some(fixo => fixo.toLowerCase() === valor.toLowerCase())) {
      config[campo] = '';
      avisos.push({
        campo,
        mensagem: `${def.rotulo}: ${valor} já está instalado direto no site. Ignorei o campo para não contar o mesmo acesso duas vezes.`
      });
      continue;
    }
    config[campo] = valor;
  }

  config.codigo_livre = String(dados.codigo_livre ?? '').trim();
  return { config, erros, avisos };
}

// Serializa para dentro do arquivo .js escapando o '<', para que nenhum valor
// cadastrado consiga fechar a string ou um bloco de script.
function paraLiteralJs(valor) {
  return JSON.stringify(valor)
    .replace(/</g, '\\x3c')
    .replace(new RegExp('\\u2028', 'g'), '\\\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\\\u2029');
}

function gerarTagsJs(config, dataIso = new Date().toISOString()) {
  const { config: limpa } = validarConfig(config);
  const blocos = [];

  const usaGtag = ['ga4', 'google_ads', 'gtm'].some(campo => limpa[campo]);
  if (usaGtag) {
    blocos.push(`
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }`);
  }

  for (const [campo, def] of Object.entries(CAMPOS)) {
    if (limpa[campo]) blocos.push(`
  // ${def.rotulo}${def.script(limpa[campo])}`);
  }

  if (limpa.codigo_livre) {
    blocos.push(`
  // Código personalizado, colado no painel
  injetarHtml(${paraLiteralJs(limpa.codigo_livre)});`);
  }

  return `/*
 * Arquivo gerado pelo painel /admin. Não edite à mão: a próxima gravação
 * pelo painel sobrescreve o que estiver aqui.
 * Última alteração: ${dataIso}
 */
window.TIBINHO_TAGS = ${paraLiteralJs(limpa)};
window.TIBINHO_TAGS_ATUALIZADO_EM = ${paraLiteralJs(dataIso)};

(function () {
  // O painel carrega este arquivo só para ler a configuração e preencher o
  // formulário. Nesse caso, nada deve ser disparado.
  if (window.TIBINHO_TAGS_NO_INJECT) return;

  function carregarScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  // innerHTML não executa script. Então recriamos cada script encontrado.
  function injetarHtml(html) {
    var molde = document.createElement('template');
    molde.innerHTML = html;
    Array.prototype.forEach.call(molde.content.querySelectorAll('script'), function (velho) {
      var novo = document.createElement('script');
      Array.prototype.forEach.call(velho.attributes, function (attr) {
        novo.setAttribute(attr.name, attr.value);
      });
      novo.text = velho.text;
      velho.parentNode.replaceChild(novo, velho);
    });
    document.head.appendChild(molde.content);
  }
${blocos.join('\n')}
})();
`;
}

module.exports = {
  DURACAO_SESSAO_MS,
  IDS_FIXOS,
  CAMPOS,
  senhaConfere,
  criarToken,
  tokenValido,
  validarConfig,
  gerarTagsJs
};
