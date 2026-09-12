/**
 * Stabilife Auth Module
 * Handles login, registration, validation, session redirects, and feedback toasts.
 */

// Toast feedback utility
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || '•'}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const Auth = {
  initLogin() {
    const loginForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const primaryBtn = document.querySelector('.primary-btn');

    // Add Demo Login button if not present
    let demoBtn = document.getElementById('demo-login-btn');
    if (!demoBtn) {
      demoBtn = document.createElement('button');
      demoBtn.id = 'demo-login-btn';
      demoBtn.type = 'button';
      demoBtn.className = 'demo-btn';
      demoBtn.innerHTML = '⚡ 1-Click Demo Login (Ajay)';
      demoBtn.style.marginTop = '12px';
      
      const authActions = document.querySelector('.auth-actions');
      if (authActions && authActions.parentNode) {
        authActions.parentNode.insertBefore(demoBtn, authActions.nextSibling);
      }
    }

    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        if (emailInput) emailInput.value = 'ajay@stabilife.com';
        if (passwordInput) passwordInput.value = 'password123';
        showToast('Demo credentials filled! Logging in...', 'info');
        setTimeout(() => this.handleLogin('ajay@stabilife.com', 'password123'), 400);
      });
    }

    const doLogin = (e) => {
      if (e) e.preventDefault();
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email) {
        showToast('Please enter your email address.', 'error');
        emailInput?.focus();
        return;
      }
      if (!email.includes('@') || !email.includes('.')) {
        showToast('Please enter a valid email address.', 'error');
        emailInput?.focus();
        return;
      }
      if (!password) {
        showToast('Please enter your password.', 'error');
        passwordInput?.focus();
        return;
      }

      this.handleLogin(email, password);
    };

    if (loginForm) {
      loginForm.addEventListener('submit', doLogin);
    }
    if (primaryBtn) {
      // Remove inline onclick handler if present
      primaryBtn.removeAttribute('onclick');
      primaryBtn.addEventListener('click', doLogin);
    }

    // Check if already logged in
    if (window.StabilifeStorage && window.StabilifeStorage.hasActiveSession()) {
      const activeUser = window.StabilifeStorage.getSession();
      if (activeUser) {
        const authCard = document.querySelector('.auth-card');
        const sessionBanner = document.createElement('div');
        sessionBanner.className = 'active-session-banner';
        sessionBanner.innerHTML = `
          <span>Signed in as <strong>${activeUser.name}</strong></span>
          <a href="main.html" class="continue-link">Go to Feed →</a>
        `;
        if (authCard) authCard.insertBefore(sessionBanner, authCard.children[2]);
      }
    }
  },

  handleLogin(email, password) {
    if (!window.StabilifeStorage) {
      showToast('Storage module error.', 'error');
      return;
    }

    const res = window.StabilifeStorage.login(email, password);
    if (res.success) {
      showToast(`Welcome back, ${res.user.name}! Redirecting...`, 'success');
      setTimeout(() => {
        window.location.href = 'main.html';
      }, 700);
    } else {
      showToast(res.error || 'Invalid email or password.', 'error');
    }
  },

  initRegister() {
    const registerForm = document.querySelector('form');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm');

    const doRegister = (e) => {
      if (e) e.preventDefault();

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      const confirm = confirmInput ? confirmInput.value : '';

      if (!name || name.length < 2) {
        showToast('Please enter your full name (at least 2 characters).', 'error');
        nameInput?.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        emailInput?.focus();
        return;
      }

      if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        passwordInput?.focus();
        return;
      }

      if (password !== confirm) {
        showToast('Passwords do not match. Please verify.', 'error');
        confirmInput?.focus();
        return;
      }

      const res = window.StabilifeStorage.registerUser({
        name,
        email,
        password
      });

      if (res.success) {
        showToast(`Account created for ${res.user.name}! Heading to app...`, 'success');
        setTimeout(() => {
          window.location.href = 'main.html';
        }, 800);
      } else {
        showToast(res.error || 'Registration failed.', 'error');
      }
    };

    if (registerForm) {
      registerForm.addEventListener('submit', doRegister);
    }
  },

  logout() {
    if (window.StabilifeStorage) {
      window.StabilifeStorage.clearSession();
    }
    showToast('Logged out successfully.', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 400);
  }
};

window.StabilifeAuth = Auth;
window.showToast = showToast;
