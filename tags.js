/*
 * Arquivo gerado pelo painel /admin. Não edite à mão: a próxima gravação
 * pelo painel sobrescreve o que estiver aqui.
 * Última alteração: 2026-10-05T17:02:31.312Z
 */
window.TIBINHO_TAGS = {"ga4":"","google_ads":"","gtm":"","meta_pixel":"","tiktok":"","linkedin":"","pinterest":"","kwai":"","codigo_livre":""};
window.TIBINHO_TAGS_ATUALIZADO_EM = "2026-10-05T17:02:31.312Z";

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

})();
