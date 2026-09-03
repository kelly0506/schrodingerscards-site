// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// The "Booth 151" line opens the mall map
const boothOpen = document.querySelector('.booth-open');
const boothDialog = document.getElementById('booth-dialog');

if (boothOpen && boothDialog) {
  boothOpen.addEventListener('click', () => boothDialog.showModal());

  // Clicking the backdrop closes it. The dialog itself fills its own box, so
  // a click landing on the <dialog> element is a click outside the content.
  boothDialog.addEventListener('click', (e) => {
    if (e.target === boothDialog) boothDialog.close();
  });
}
