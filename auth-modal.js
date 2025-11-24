// Auth Modal System - Novaxell Premium

class AuthModal {
  constructor() {
    this.modal = document.getElementById('authModal');
    this.form = document.getElementById('authForm');
    this.closeBtn = document.getElementById('authModalClose');
    this.toggleBtn = document.getElementById('authToggleBtn');
    this.submitBtn = document.getElementById('authSubmitBtn');
    this.discordBtn = document.getElementById('authDiscordBtn');
    
    this.mode = 'login'; // 'login' or 'register'
    this.isLoading = false;
    
    this.init();
  }

  init() {
    this.attachEventListeners();
    this.setupPasswordToggles();
  }

  attachEventListeners() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.toggleBtn.addEventListener('click', () => this.toggleMode());
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.discordBtn.addEventListener('click', () => this.handleDiscordLogin());
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });
  }

  setupPasswordToggles() {
    const toggles = [
      { btn: document.getElementById('authPasswordToggle'), input: document.getElementById('authPassword') },
      { btn: document.getElementById('authConfirmPasswordToggle'), input: document.getElementById('authConfirmPassword') }
    ];

    toggles.forEach(({ btn, input }) => {
      if (btn && input) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
      }
    });
  }

  open(mode = 'login') {
    this.mode = mode;
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.updateUI();
    this.clearForm();
  }

  close() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.clearForm();
  }

  toggleMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.updateUI();
    this.clearForm();
  }

  updateUI() {
    const isLogin = this.mode === 'login';
    
    // Update title and subtitle
    document.getElementById('authModalTitle').textContent = isLogin ? 'Connexion' : 'Inscription';
    document.getElementById('authModalSubtitle').textContent = isLogin 
      ? 'Accédez à votre compte Novaxell' 
      : 'Créez votre compte Novaxell';

    // Update input label
    document.getElementById('authInputLabel').textContent = isLogin ? 'Code utilisateur' : 'Code utilisateur';

    // Toggle register-only fields
    document.getElementById('usernameGroup').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('emailGroup').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('confirmPasswordGroup').style.display = isLogin ? 'none' : 'flex';

    // Update submit button
    this.submitBtn.querySelector('.auth-submit-text').textContent = isLogin ? 'Se connecter' : 'S\'inscrire';

    // Update toggle text
    document.getElementById('authToggleText').innerHTML = isLogin
      ? 'Pas de compte ? <button type="button" class="auth-toggle-btn" id="authToggleBtn">S\'inscrire</button>'
      : 'Déjà un compte ? <button type="button" class="auth-toggle-btn" id="authToggleBtn">Se connecter</button>';

    // Reattach toggle listener
    document.getElementById('authToggleBtn').addEventListener('click', () => this.toggleMode());

    // Update form validation
    document.getElementById('authInput').required = true;
    document.getElementById('authPassword').required = true;
    if (!isLogin) {
      document.getElementById('authConfirmPassword').required = true;
    }
  }

  clearForm() {
    this.form.reset();
    this.clearErrors();
  }

  clearErrors() {
    document.querySelectorAll('.auth-form-error').forEach(el => el.textContent = '');
    document.getElementById('authGeneralError').style.display = 'none';
  }

  showError(fieldId, message) {
    const errorEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  showGeneralError(message) {
    const errorEl = document.getElementById('authGeneralError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.submitBtn.disabled = loading;
    this.submitBtn.querySelector('.auth-submit-text').style.display = loading ? 'none' : 'inline';
    this.submitBtn.querySelector('.auth-submit-loader').style.display = loading ? 'inline' : 'none';
  }

  validateForm() {
    this.clearErrors();
    let isValid = true;

    const code = document.getElementById('authInput').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!code) {
      this.showError('authInputError', 'Le code est requis');
      isValid = false;
    }

    if (!password) {
      this.showError('authPasswordError', 'Le mot de passe est requis');
      isValid = false;
    } else if (password.length < 6) {
      this.showError('authPasswordError', 'Le mot de passe doit contenir au moins 6 caractères');
      isValid = false;
    }

    if (this.mode === 'register') {
      const username = document.getElementById('authUsername').value.trim();
      const email = document.getElementById('authEmail').value.trim();
      const confirmPassword = document.getElementById('authConfirmPassword').value;

      if (!username) {
        this.showError('authUsernameError', 'Le nom d\'utilisateur est requis');
        isValid = false;
      }

      if (email && !this.isValidEmail(email)) {
        this.showError('authEmailError', 'Email invalide');
        isValid = false;
      }

      if (!confirmPassword) {
        this.showError('authConfirmPasswordError', 'Veuillez confirmer le mot de passe');
        isValid = false;
      } else if (password !== confirmPassword) {
        this.showError('authConfirmPasswordError', 'Les mots de passe ne correspondent pas');
        isValid = false;
      }
    }

    return isValid;
  }

  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.validateForm()) return;

    this.setLoading(true);

    try {
      const code = document.getElementById('authInput').value.trim();
      const password = document.getElementById('authPassword').value;

      let endpoint, payload;

      if (this.mode === 'login') {
        endpoint = '/auth/login';
        payload = { code, password };
      } else {
        endpoint = '/auth/register';
        payload = {
          code,
          password,
          username: document.getElementById('authUsername').value.trim(),
          email: document.getElementById('authEmail').value.trim() || null
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        this.showGeneralError(data.error || 'Une erreur est survenue');
        this.setLoading(false);
        return;
      }

      // Success
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // Update UI
      this.updateUserUI(data.user);

      // Close modal
      this.close();

      // Show success message
      this.showSuccessMessage(this.mode === 'login' ? 'Connexion réussie !' : 'Inscription réussie !');

    } catch (error) {
      console.error('Auth error:', error);
      this.showGeneralError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      this.setLoading(false);
    }
  }

  handleDiscordLogin() {
    window.open('https://discord.com/invite/novaxell', '_blank');
  }

  updateUserUI(user) {
    // Update navbar or user menu if it exists
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
      userMenu.innerHTML = `
        <span class="user-name">${user.username || user.code}</span>
        <button class="logout-btn" onclick="authModal.logout()">Déconnexion</button>
      `;
    }
  }

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    location.reload();
  }

  showSuccessMessage(message) {
    // Use SweetAlert2 if available, otherwise use alert
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: message,
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      alert(message);
    }
  }

  // Check if user is logged in
  static isLoggedIn() {
    return !!localStorage.getItem('authToken');
  }

  // Get current user
  static getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.authModal = new AuthModal();
});

// Helper functions to open modal from anywhere
function openLoginModal() {
  if (window.authModal) {
    window.authModal.open('login');
  }
}

function openRegisterModal() {
  if (window.authModal) {
    window.authModal.open('register');
  }
}
