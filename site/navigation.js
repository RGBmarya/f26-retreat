(() => {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('weekend-nav');
  const openIcon = document.getElementById('menu-open-icon');
  const closeIcon = document.getElementById('menu-close-icon');
  const mobile = window.matchMedia('(max-width: 600px)');
  let open = false;

  function render() {
    const expanded = mobile.matches && open;
    toggle.hidden = !mobile.matches;
    nav.hidden = mobile.matches && !open;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Close navigation menu' : 'Open navigation menu');
    openIcon.hidden = expanded;
    closeIcon.hidden = !expanded;
  }

  function close(restoreFocus = false) {
    open = false;
    render();
    if (restoreFocus && mobile.matches) toggle.focus();
  }

  toggle.addEventListener('click', () => {
    open = !open;
    render();
  });
  nav.addEventListener('click', event => {
    if (mobile.matches && event.target.closest('a')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
    }
  });
  document.addEventListener('click', event => {
    if (open && !toggle.contains(event.target) && !nav.contains(event.target)) close();
  });
  mobile.addEventListener('change', () => close(nav.contains(document.activeElement)));
  render();
})();
