(function () {
  // This site has no bundler, so this is the static HTML equivalent of
  // @vercel/analytics' inject(). Keep local previews quiet while tracking both
  // the production domains and Vercel previews.
  const host = location.hostname;
  if (host !== 'machinefutures.ai' && host !== 'www.machinefutures.ai' && !host.endsWith('.vercel.app')) return;

  window.va = window.va || function (...args) {
    (window.vaq = window.vaq || []).push(args);
  };

  const script = document.createElement('script');
  script.src = '/_vercel/insights/script.js';
  script.defer = true;
  script.dataset.sdkn = '@vercel/analytics';
  script.dataset.sdkv = '2.0.1';
  document.head.appendChild(script);
})();
