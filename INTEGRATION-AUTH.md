# 🔐 Système d'Authentification Novaxell - Guide d'Intégration

## 📋 Fichiers Créés

1. **auth-modal.css** - Styles de la modale (palette Novaxell : bleu foncé + néon violet)
2. **auth-modal.js** - Logique complète du système d'authentification
3. **auth-modal-component.html** - Composant HTML réutilisable
4. **index.html** - Intégration complète (déjà faite)

---

## 🚀 Intégration sur les Autres Pages

### Étape 1 : Ajouter les liens CSS et JS dans le `<head>`

```html
<!-- Auth Modal System -->
<link rel="stylesheet" href="auth-modal.css">
<script src="auth-modal.js" defer></script>
```

Placez ces lignes après vos autres CSS/JS externes (après Swiper, SweetAlert2, etc.)

### Étape 2 : Ajouter le composant HTML avant `</body>`

Copiez-collez ce bloc avant la fermeture du `</body>` :

```html
<!-- Auth Modal Component -->
<div id="authModal" class="auth-modal-overlay">
  <div class="auth-modal-container">
    <button class="auth-modal-close" id="authModalClose">
      <i class="fas fa-times"></i>
    </button>
    <div class="auth-modal-content">
      <div class="auth-modal-header">
        <h1 class="auth-modal-title" id="authModalTitle">Connexion</h1>
        <p class="auth-modal-subtitle" id="authModalSubtitle">Accédez à votre compte Novaxell</p>
      </div>
      <form id="authForm" class="auth-form">
        <div class="auth-form-group">
          <label for="authInput" class="auth-form-label" id="authInputLabel">Code utilisateur</label>
          <input type="text" id="authInput" class="auth-form-input" placeholder="NOVA-USER123" required />
          <span class="auth-form-error" id="authInputError"></span>
        </div>
        <div class="auth-form-group" id="usernameGroup" style="display: none;">
          <label for="authUsername" class="auth-form-label">Nom d'utilisateur</label>
          <input type="text" id="authUsername" class="auth-form-input" placeholder="Votre nom" />
          <span class="auth-form-error" id="authUsernameError"></span>
        </div>
        <div class="auth-form-group" id="emailGroup" style="display: none;">
          <label for="authEmail" class="auth-form-label">Email (optionnel)</label>
          <input type="email" id="authEmail" class="auth-form-input" placeholder="votre@email.com" />
          <span class="auth-form-error" id="authEmailError"></span>
        </div>
        <div class="auth-form-group">
          <label for="authPassword" class="auth-form-label">Mot de passe</label>
          <div class="auth-password-wrapper">
            <input type="password" id="authPassword" class="auth-form-input" placeholder="••••••••" required />
            <button type="button" class="auth-password-toggle" id="authPasswordToggle">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <span class="auth-form-error" id="authPasswordError"></span>
        </div>
        <div class="auth-form-group" id="confirmPasswordGroup" style="display: none;">
          <label for="authConfirmPassword" class="auth-form-label">Confirmer le mot de passe</label>
          <div class="auth-password-wrapper">
            <input type="password" id="authConfirmPassword" class="auth-form-input" placeholder="••••••••" />
            <button type="button" class="auth-password-toggle" id="authConfirmPasswordToggle">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <span class="auth-form-error" id="authConfirmPasswordError"></span>
        </div>
        <div class="auth-form-error-general" id="authGeneralError" style="display: none;"></div>
        <button type="submit" class="auth-form-submit" id="authSubmitBtn">
          <span class="auth-submit-text">Se connecter</span>
          <span class="auth-submit-loader" style="display: none;">
            <i class="fas fa-spinner fa-spin"></i>
          </span>
        </button>
      </form>
      <div class="auth-modal-toggle">
        <p id="authToggleText">Pas de compte ? <button type="button" class="auth-toggle-btn" id="authToggleBtn">S'inscrire</button></p>
      </div>
      <div class="auth-modal-divider">
        <span>ou</span>
      </div>
      <div class="auth-modal-social">
        <button type="button" class="auth-social-btn" id="authDiscordBtn">
          <i class="fab fa-discord"></i>
          Discord
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## 🎯 Utilisation dans le Code

### Ouvrir la modale de connexion

```html
<button onclick="openLoginModal()">Se connecter</button>
```

### Ouvrir la modale d'inscription

```html
<button onclick="openRegisterModal()">S'inscrire</button>
```

### Vérifier si l'utilisateur est connecté

```javascript
if (AuthModal.isLoggedIn()) {
  console.log('Utilisateur connecté');
  const user = AuthModal.getUser();
  console.log(user);
}
```

### Déconnecter l'utilisateur

```javascript
authModal.logout();
```

---

## 🔌 API Backend Requise

Le système appelle ces endpoints :

### POST `/auth/login`
```json
{
  "code": "NOVA-USER123",
  "password": "password123"
}
```

**Réponse succès :**
```json
{
  "success": true,
  "user": {
    "id": "123",
    "code": "NOVA-USER123",
    "username": "User",
    "email": "user@example.com",
    "role": "user",
    "isPremium": false
  },
  "token": "eyJhbGc..."
}
```

### POST `/auth/register`
```json
{
  "code": "NOVA-USER123",
  "password": "password123",
  "username": "User",
  "email": "user@example.com"
}
```

**Réponse succès :**
```json
{
  "success": true,
  "user": { ... },
  "token": "eyJhbGc..."
}
```

---

## 🎨 Personnalisation

### Modifier les couleurs

Éditez `auth-modal.css` et changez les variables CSS :

```css
:root {
  --auth-primary: #7B5BFF;        /* Violet principal */
  --auth-accent: #D965FF;         /* Rose/Violet accent */
  --auth-dark: #0C1F4A;           /* Bleu foncé */
  --auth-darker: #050D1F;         /* Bleu très foncé */
  /* ... autres variables ... */
}
```

### Modifier les textes

Éditez `auth-modal.js` dans la méthode `updateUI()` :

```javascript
document.getElementById('authModalTitle').textContent = 'Votre titre';
document.getElementById('authModalSubtitle').textContent = 'Votre sous-titre';
```

---

## ✅ Checklist d'Intégration

- [ ] Ajouter les liens CSS et JS dans le `<head>`
- [ ] Ajouter le composant HTML avant `</body>`
- [ ] Tester l'ouverture de la modale : `openLoginModal()`
- [ ] Tester le switch login/register
- [ ] Tester la validation des champs
- [ ] Tester l'appel API au backend
- [ ] Vérifier le stockage du token JWT
- [ ] Tester la déconnexion

---

## 🐛 Dépannage

### La modale ne s'ouvre pas
- Vérifiez que `auth-modal.js` est chargé (console → pas d'erreur)
- Vérifiez que `authModal` est défini : `console.log(window.authModal)`

### Les styles ne s'appliquent pas
- Vérifiez que `auth-modal.css` est chargé
- Vérifiez les chemins relatifs des fichiers

### L'API ne répond pas
- Vérifiez que le serveur Express est démarré
- Vérifiez les endpoints : `/auth/login` et `/auth/register`
- Vérifiez les logs du serveur

---

## 📞 Support

Pour toute question ou problème, consultez les fichiers :
- `auth-modal.js` - Logique complète avec commentaires
- `auth-modal.css` - Styles avec variables CSS
- `index.html` - Exemple d'intégration complète

---

**Système d'authentification Novaxell - Prêt pour la production ! 🚀**
