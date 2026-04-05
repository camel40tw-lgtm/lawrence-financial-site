
const header = document.getElementById('siteHeader');

const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  if (!header) return;
  if (window.scrollY > 16) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
});

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// Active Nav Link Support
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
navLinks?.querySelectorAll('a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath) {
    link.classList.add('active');
  } else if (currentPath !== 'index.html') {
    // If we're not on home, make sure "Home" is not active
    if (href === 'index.html') link.classList.remove('active');
  }
});


const reveals = document.querySelectorAll('.reveal');
if (reveals.length) {
  const io = new IntersectionObserver((entries) => {
    let delayCounter = 0;
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (entry.target.classList.contains('feature-card') || 
            entry.target.classList.contains('service-card') || 
            entry.target.classList.contains('article-card') ||
            entry.target.classList.contains('stat-box')) {
          entry.target.style.transitionDelay = `${delayCounter * 0.12}s`;
          delayCounter++;
        }
        entry.target.classList.add('show');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  reveals.forEach((el) => io.observe(el));
}

// Theme Toggle Logic
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      try {
        localStorage.setItem('theme', 'light');
      } catch (error) {
        // Ignore storage access issues triggered by browser settings.
      }
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch (error) {
        // Ignore storage access issues triggered by browser settings.
      }
    }
  });
}

const bookingForm = document.querySelector('[data-booking-form]');
if (bookingForm) {
  const submitButton = bookingForm.querySelector('.contact-submit');
  const statusBox = bookingForm.querySelector('[data-form-status]');
  const defaultSubmitLabel = submitButton?.textContent?.trim() || '送出預約 / 留言';

  const showStatus = (message, type) => {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `contact-status is-visible ${type === 'error' ? 'is-error' : 'is-success'}`;
  };

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const honeypot = bookingForm.querySelector('input[name="company"]');
    if (honeypot && honeypot.value.trim() !== '') return;

    if (!bookingForm.reportValidity()) return;

    const formData = new FormData(bookingForm);
    const action = bookingForm.getAttribute('action');

    if (!action) {
      showStatus('表單設定異常，請先改用 LINE 或 Email 與我聯繫。', 'error');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = '送出中...';
    }
    showStatus('正在送出表單，請稍候...', 'success');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      await fetch(action, {
        method: bookingForm.method || 'POST',
        body: formData,
        mode: 'no-cors',
        signal: controller.signal
      });

      showStatus('表單已送出，正在前往確認頁面...', 'success');
      window.setTimeout(() => {
        window.location.href = 'thanks.html';
      }, 500);
    } catch (error) {
      showStatus('目前無法完成送出，請稍後再試，或改用 LINE / Email 聯繫。', 'error');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultSubmitLabel;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  });
}

// Quick placeholder config helper for booking/LINE if needed later.
window.SITE_CONFIG = {
  bookingUrl: "contact.html#booking",
  lineUrl: "https://line.me/ti/p/iaCU1C6Wbl"
};
