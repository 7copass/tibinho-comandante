const { test } = require('node:test');
const assert = require('node:assert');
const lib = require('../api/_lib.js');

const SENHA = 'senha-de-teste-123';
const AGORA = 1791220000000;

test('senha correta é aceita', () => {
  assert.equal(lib.senhaConfere('senha-de-teste-123', SENHA), true);
});

test('senha errada é recusada', () => {
  assert.equal(lib.senhaConfere('senha-errada', SENHA), false);
});

test('senha vazia é recusada mesmo se a configurada for vazia', () => {
  assert.equal(lib.senhaConfere('', ''), false);
  assert.equal(lib.senhaConfere('', SENHA), false);
  assert.equal(lib.senhaConfere(SENHA, ''), false);
});

test('senha de tamanho diferente é recusada sem estourar', () => {
  assert.equal(lib.senhaConfere('x', SENHA), false);
  assert.equal(lib.senhaConfere(SENHA + 'extra', SENHA), false);
});

test('token recém-criado é válido', () => {
  const token = lib.criarToken(SENHA, AGORA);
  assert.equal(lib.tokenValido(token, SENHA, AGORA + 1000), true);
});

test('token vencido é recusado', () => {
  const token = lib.criarToken(SENHA, AGORA);
  const depois = AGORA + lib.DURACAO_SESSAO_MS + 1;
  assert.equal(lib.tokenValido(token, SENHA, depois), false);
});

test('token adulterado é recusado', () => {
  const token = lib.criarToken(SENHA, AGORA);
  const [corpo, assinatura] = token.split('.');
  const outroCorpo = Buffer.from(
    JSON.stringify({ exp: AGORA + 999999999 })
  ).toString('base64url');
  assert.equal(lib.tokenValido(`${outroCorpo}.${assinatura}`, SENHA, AGORA), false);
  assert.equal(lib.tokenValido(`${corpo}.assinaturafalsa`, SENHA, AGORA), false);
});

test('token assinado com outra senha é recusado', () => {
  const token = lib.criarToken('outra-senha', AGORA);
  assert.equal(lib.tokenValido(token, SENHA, AGORA), false);
});

test('token mal formado é recusado sem estourar', () => {
  for (const ruim of ['', 'abc', 'a.b.c', null, undefined, '.', 'YWJj.']) {
    assert.equal(lib.tokenValido(ruim, SENHA, AGORA), false);
  }
});

test('IDs em formato válido passam', () => {
  const { erros } = lib.validarConfig({
    ga4: 'G-ABC123XYZ',
    google_ads: 'AW-12345678',
    gtm: 'GTM-ABC1234',
    meta_pixel: '1234567890123',
    tiktok: 'CABCDE12345FGHIJ',
    linkedin: '1234567',
    pinterest: '2612345678901',
    kwai: 'abc123'
  });
  assert.deepEqual(erros, []);
});

test('IDs em formato inválido são recusados com mensagem por campo', () => {
  const { erros } = lib.validarConfig({
    ga4: '731D1FZLCT',
    google_ads: 'AW-abc',
    gtm: 'GTM',
    meta_pixel: 'pixel-do-meta',
    linkedin: 'abc'
  });
  const campos = erros.map(e => e.campo).sort();
  assert.deepEqual(campos, ['ga4', 'gtm', 'google_ads', 'linkedin', 'meta_pixel'].sort());
  assert.ok(erros.every(e => typeof e.mensagem === 'string' && e.mensagem.length > 0));
});

test('campos vazios são aceitos e não geram script', () => {
  const { erros, config } = lib.validarConfig({ ga4: '', meta_pixel: '   ' });
  assert.deepEqual(erros, []);
  assert.equal(config.ga4, '');
  assert.equal(config.meta_pixel, '');
});

test('espaços em volta do ID são removidos', () => {
  const { config } = lib.validarConfig({ meta_pixel: '  1234567890123  ' });
  assert.equal(config.meta_pixel, '1234567890123');
});

test('campo desconhecido é descartado', () => {
  const { config } = lib.validarConfig({ meta_pixel: '1234567890123', vizinho: 'xxx' });
  assert.equal(config.vizinho, undefined);
});

test('IDs já fixos no index.html são ignorados para não contar duas vezes', () => {
  const { erros, config, avisos } = lib.validarConfig({
    ga4: 'G-731D1FZLCT',
    google_ads: 'AW-18369974279'
  });
  assert.deepEqual(erros, []);
  assert.equal(config.ga4, '');
  assert.equal(config.google_ads, '');
  assert.equal(avisos.length, 2);
});

test('o tags.js gerado guarda a configuração e a data', () => {
  const js = lib.gerarTagsJs({ meta_pixel: '1234567890123' }, '2026-10-05T12:00:00.000Z');
  assert.match(js, /window\.TIBINHO_TAGS\s*=/);
  assert.match(js, /1234567890123/);
  assert.match(js, /2026-10-05T12:00:00\.000Z/);
});

test('o tags.js gerado não injeta nada quando a configuração está vazia', () => {
  const js = lib.gerarTagsJs({}, '2026-10-05T12:00:00.000Z');
  assert.doesNotMatch(js, /fbevents/);
  assert.doesNotMatch(js, /googletagmanager/);
});

test('cada rede cadastrada gera o script dela', () => {
  const js = lib.gerarTagsJs({
    meta_pixel: '1234567890123',
    ga4: 'G-NOVO123',
    gtm: 'GTM-ABC1234',
    tiktok: 'CABCDE12345FGHIJ',
    linkedin: '1234567',
    pinterest: '2612345678901',
    kwai: 'abc123'
  }, '2026-10-05T12:00:00.000Z');
  assert.match(js, /fbevents\.js/);
  assert.match(js, /gtag\/js\?id=G-NOVO123/);
  assert.match(js, /gtm\.js\?id=GTM-ABC1234/);
  assert.match(js, /analytics\.tiktok\.com/);
  assert.match(js, /snap\.licdn\.com/);
  assert.match(js, /pintrk/);
  assert.match(js, /kwai/i);
});

test('o código livre entra no arquivo gerado', () => {
  const js = lib.gerarTagsJs(
    { codigo_livre: '<script>window.MEU_TESTE = 1;<\/script>' },
    '2026-10-05T12:00:00.000Z'
  );
  assert.match(js, /MEU_TESTE/);
});

test('o código livre não consegue escapar da string onde é guardado', () => {
  const ataque = '</script><script>window.ESCAPOU = 1;<\/script>';
  const js = lib.gerarTagsJs({ codigo_livre: ataque }, '2026-10-05T12:00:00.000Z');
  assert.doesNotMatch(js, /<\/script>/i);
});

test('o tags.js gerado é JavaScript válido', () => {
  const js = lib.gerarTagsJs({ meta_pixel: '1234567890123', ga4: 'G-NOVO123' }, '2026-10-05T12:00:00.000Z');
  assert.doesNotThrow(() => new Function(js));
});
