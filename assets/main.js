
// ─── Header scroll shadow ───────────────────────────────────────────────────
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 16);
}, { passive: true });

// ─── Mobile menu toggle ──────────────────────────────────────────────────────
const menuToggle = document.getElementById('menuToggle');
const navLinks  = document.getElementById('navLinks');

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ─── Active nav link (robust pathname match) ─────────────────────────────────
(function markActiveNav() {
  if (!navLinks) return;
  // Normalise: strip query/hash, get the last path segment
  const rawPath = window.location.pathname.replace(/\/$/, '');
  const currentFile = rawPath.split('/').pop() || 'index.html';

  navLinks.querySelectorAll('a:not(.nav-cta)').forEach(link => {
    const href = link.getAttribute('href')?.split('#')[0] || '';
    const match = href === currentFile || (currentFile === '' && href === 'index.html');
    link.classList.toggle('active', match);
  });
})();

// ─── Reveal on scroll (staggered per batch) ──────────────────────────────────
const STAGGERED_CLASSES = new Set(['feature-card', 'service-card', 'article-card', 'stat-box']);

const reveals = document.querySelectorAll('.reveal');
if (reveals.length) {
  const io = new IntersectionObserver((entries) => {
    // Only stagger elements visible in this batch (isIntersecting)
    let batchDelay = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const isStaggered = [...el.classList].some(c => STAGGERED_CLASSES.has(c));
      if (isStaggered) {
        el.style.transitionDelay = `${batchDelay * 0.12}s`;
        batchDelay++;
      }
      el.classList.add('show');
      io.unobserve(el);
    });
  }, { threshold: 0.14 });

  reveals.forEach(el => io.observe(el));
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    try { localStorage.setItem('theme', isDark ? 'light' : 'dark'); } catch (_) {}
    // Update theme-color meta for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#ffffff' : '#0A192F');
    }
  });
}

// ─── Contact / booking form ───────────────────────────────────────────────────
const bookingForm = document.querySelector('[data-booking-form]');
if (bookingForm) {
  const submitButton = bookingForm.querySelector('.contact-submit');
  const statusBox    = bookingForm.querySelector('[data-form-status]');
  const defaultLabel = submitButton?.textContent?.trim() || '送出預約申請';

  const showStatus = (message, type) => {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className   = `contact-status is-visible ${type === 'error' ? 'is-error' : 'is-success'}`;
  };

  const resetButton = () => {
    if (!submitButton) return;
    submitButton.disabled    = false;
    submitButton.textContent = defaultLabel;
  };

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Honeypot check
    const honeypot = bookingForm.querySelector('input[name="company"]');
    if (honeypot && honeypot.value.trim() !== '') return;

    if (!bookingForm.reportValidity()) return;

    const action = bookingForm.getAttribute('action');
    if (!action) {
      showStatus('表單設定異常，請改用 LINE 或 Email 與我聯繫。', 'error');
      return;
    }

    if (submitButton) {
      submitButton.disabled    = true;
      submitButton.textContent = '送出中...';
    }
    showStatus('正在送出表單，請稍候…', 'success');

    const controller = new AbortController();
    const timeoutId  = window.setTimeout(() => controller.abort(), 12000);

    try {
      await fetch(action, {
        method : bookingForm.getAttribute('method') || 'POST',
        body   : new FormData(bookingForm),
        mode   : 'no-cors',
        signal : controller.signal,
      });
      showStatus('表單已送出，正在前往確認頁面…', 'success');
      window.setTimeout(() => { window.location.href = 'thanks.html'; }, 500);
    } catch (error) {
      if (error.name === 'AbortError') {
        showStatus('送出逾時，請稍後再試，或改用 LINE / Email 聯繫。', 'error');
      } else {
        showStatus('目前無法完成送出，請稍後再試，或改用 LINE / Email 聯繫。', 'error');
      }
      resetButton();
    } finally {
      window.clearTimeout(timeoutId);
    }
  });
}

// ─── Global site config ───────────────────────────────────────────────────────
window.SITE_CONFIG = {
  bookingUrl : 'contact.html#booking',
  lineUrl    : 'https://line.me/ti/p/iaCU1C6Wbl',
};

// ─── Stat Counter Animation ──────────────────────────────────────────────────
const statBoxes = document.querySelectorAll('.stat-box strong');
if (statBoxes.length) {
  const statIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const text = el.innerText;
      const match = text.match(/(\d+)(.*)/);
      if (match) {
        let max = parseInt(match[1], 10);
        let suffix = match[2] || '';
        let current = 0;
        let inc = Math.max(1, Math.ceil(max / 40));
        let int = setInterval(() => {
          current += inc;
          if (current >= max) {
            current = max;
            clearInterval(int);
          }
          el.innerText = current + suffix;
        }, 30);
        statIo.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  statBoxes.forEach(el => statIo.observe(el));
}
