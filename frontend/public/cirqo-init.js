// Runs before the first paint (a plain, blocking script in <head>), so the page never flashes the wrong theme or the splash.
// 1) Sets the saved (or system) theme.
try {
  var t = localStorage.getItem('cirqo.theme');
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
} catch (e) {}
// 2) Hides the opening splash when it already played in this tab (unless ?splash=1) or when motion is reduced.
try {
  var seen = sessionStorage.getItem('cirqo:splash:v1') === '1' && !/[?&]splash=1/.test(location.search);
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.setAttribute('data-splash', 'done');
} catch (e) {}
