const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const https = require('https');
const querystring = require('querystring');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const morgan = require('morgan');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const paypal = require('@paypal/checkout-server-sdk');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
// Middlewares de parsing du corps des requêtes (JSON / x-www-form-urlencoded)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    // Désactive le cache pour les fichiers HTML en développement
    if (process.env.NODE_ENV === 'development' && path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

let users = [];
let generations = [];
let orders = [];
const ordersFile = path.join(__dirname, 'orders.json');

async function loadOrders() {
  try {
    const data = await fs.readFile(ordersFile, 'utf8');
    orders = JSON.parse(data);
  } catch (e) {
    orders = [];
  }
}

async function saveOrders() {
  try {
    await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error('Erreur sauvegarde orders:', e);
  }
}

async function loadUsers() {
  try {
    const data = await fs.readFile(path.join(__dirname, 'src/data/users.json'), 'utf8');
    users = JSON.parse(data);
  } catch (error) {
    users = [];
  }
}

async function saveUsers() {
  try {
    await fs.writeFile(path.join(__dirname, 'src/data/users.json'), JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
}

// === Configuration PayPal Checkout (biens & services) ===
function getPayPalClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

  const isProd = process.env.NODE_ENV === 'production';
  const Environment = isProd
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

  const env = new Environment(clientId, clientSecret);
  return new paypal.core.PayPalHttpClient(env);
}

const payPalClient = getPayPalClient();

// Configuration de sécurité Helmet simplifiée pour le développement
app.use(helmet({
  contentSecurityPolicy: false // Désactive temporairement la CSP stricte
}));

// Configuration CORS plus permissive pour le développement
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(morgan('dev')); // Format plus lisible pour le développement

// Configuration du rate limiting uniquement pour les routes API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.'
});

// Applique le rate limiting uniquement aux routes API
app.use('/api', apiLimiter);
app.use('/auth', apiLimiter);
app.use('/paypal', apiLimiter);

app.use(session({
  secret: process.env.SESSION_SECRET || 'novaxell-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Enregistrer un ordre côté frontend (simple, sans logique F&F spécifique)
app.post('/orders/register', async (req, res) => {
  try {
    const { orderId, discordTag, total, currency } = req.body || {};
    if (!orderId || !total) return res.status(400).json({ success: false, error: 'orderId et total requis' });

    const existing = orders.find(o => o.orderId === orderId);
    if (existing) {
      return res.json({ success: true });
    }

    orders.push({
      orderId,
      discordTag: discordTag || null,
      total: String(total),
      currency: String(currency || 'EUR'),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    await saveOrders();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Erreur enregistrement ordre' });
  }
});

// Statut simple d'un ordre
app.get('/orders/status', (req, res) => {
  const { orderId } = req.query;
  const order = orders.find(o => o.orderId === orderId);
  if (!order) return res.json({ success: true, status: 'unknown' });
  res.json({ success: true, status: order.status, order });
});

// --- PayPal Checkout: création d'une commande ---
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency } = req.body || {};
    const numericAmount = parseFloat(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Montant invalide' });
    }

    const cur = (currency || 'EUR').toUpperCase();

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: cur,
            value: numericAmount.toFixed(2)
          }
        }
      ]
    });

    const order = await payPalClient.execute(request);
    return res.json({ success: true, id: order.result.id });
  } catch (err) {
    console.error('Erreur /create-order PayPal:', err);
    return res.status(500).json({ success: false, error: 'Erreur création commande PayPal' });
  }
});

// --- PayPal Checkout: capture après paiement ---
app.post('/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body || {};
    if (!orderID) {
      return res.status(400).json({ success: false, error: 'orderID requis' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const capture = await payPalClient.execute(request);

    return res.json({
      success: true,
      status: capture.result.status,
      details: capture.result
    });
  } catch (err) {
    console.error('Erreur /capture-order PayPal:', err);
    return res.status(500).json({ success: false, error: 'Erreur capture paiement' });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token && !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Token manquant' });
  }

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
      if (err) return res.status(403).json({ success: false, error: 'Token invalide' });
      req.user = users.find(u => u.id === user.id);
      next();
    });
  } else if (req.session.userId) {
    req.user = users.find(u => u.id === req.session.userId);
    if (req.user) {
      next();
    } else {
      res.status(401).json({ success: false, error: 'Session invalide' });
    }
  }
}

app.post('/auth/register', async (req, res) => {
  try {
    const { code, password, username, email } = req.body;

    if (!code || !password) {
      return res.status(400).json({ success: false, error: 'Code et mot de passe requis' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Mot de passe minimum 6 caractères' });
    }

    const existingUser = users.find(u => u.code === code);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Ce code est déjà utilisé'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      code,
      password: hashedPassword,
      username: username || code,
      email: email || null,
      role: code === 'NOVA-ADMIN' ? 'admin' : 'user',
      isPremium: code === 'NOVA-ADMIN',
      createdAt: new Date(),
      stats: {
        totalGenerations: 0,
        favoriteServices: [],
        lastActivity: new Date()
      }
    };

    users.push(user);
    await saveUsers();
    req.session.userId = user.id;

    const token = jwt.sign(
      { id: user.id, code: user.code },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      success: true,
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'inscription'
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { code, password } = req.body;

    if (!code || !password) {
      return res.status(400).json({
        success: false,
        error: 'Code et mot de passe requis'
      });
    }

    // Trouver l'utilisateur
    const user = users.find(u => u.code === code);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Code ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Code ou mot de passe incorrect'
      });
    }

    // Créer la session
    req.session.userId = user.id;

    // Créer le token JWT
    const token = jwt.sign(
      { id: user.id, code: user.code },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    // Mettre à jour la dernière activité
    user.stats.lastActivity = new Date();
    await saveUsers();

    const userResponse = { ...user };
    delete userResponse.password;

    res.json({
      success: true,
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la connexion'
    });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la déconnexion'
      });
    }
    res.json({ success: true });
  });
});

app.get('/auth/check', (req, res) => {
  if (req.session.userId) {
    const user = users.find(u => u.id === req.session.userId);
    if (user) {
      const userResponse = { ...user };
      delete userResponse.password;
      return res.json({
        success: true,
        user: userResponse
      });
    }
  }
  res.json({ success: false });
});

// Routes API
app.get('/api/services', async (req, res) => {
  try {
    const defaultServices = require('./src/data/default-services.json');
    const services = await Promise.all(defaultServices.map(async (service) => {
      const filePath = path.join(__dirname, 'stocks', `${service.name}.txt`);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const accounts = content.split('\n').filter(line => line.trim().length > 0);
        return { ...service, stock: accounts.length };
      } catch (error) {
        return { ...service, stock: 0 };
      }
    }));

    res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Erreur services:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des services'
    });
  }
});

app.post('/api/generate', authenticateToken, async (req, res) => {
  try {
    const { service } = req.body;
    
    if (!service) {
      return res.status(400).json({
        success: false,
        error: 'Service requis'
      });
    }

    const filePath = path.join(__dirname, 'stocks', `${service}.txt`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const accounts = content.split('\n').filter(line => line.trim().length > 0);
      
      if (accounts.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Aucun compte disponible pour ce service'
        });
      }

      const account = accounts.shift();
      await fs.writeFile(filePath, accounts.join('\n'), 'utf8');

      // Enregistrer la génération
      const generation = {
        id: Date.now().toString(),
        userId: req.user.id,
        service,
        account: parseAccount(account),
        createdAt: new Date()
      };
      
      generations.push(generation);

      // Mettre à jour les stats utilisateur
      req.user.stats.totalGenerations++;
      if (!req.user.stats.favoriteServices.includes(service)) {
        req.user.stats.favoriteServices.push(service);
      }
      await saveUsers();

      res.json({
        success: true,
        account: generation.account,
        service,
        generatedAt: generation.createdAt
      });

    } catch (fileError) {
      res.status(404).json({
        success: false,
        error: 'Service non disponible'
      });
    }

  } catch (error) {
    console.error('Erreur génération:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération'
    });
  }
});

app.get('/api/history', authenticateToken, (req, res) => {
  try {
    const userGenerations = generations
      .filter(g => g.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.json({
      success: true,
      history: userGenerations
    });
  } catch (error) {
    console.error('Erreur historique:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

app.get('/api/stats', authenticateToken, (req, res) => {
  try {
    const userGenerations = generations.filter(g => g.userId === req.user.id);
    
    res.json({
      success: true,
      stats: {
        ...req.user.stats,
        recentGenerations: userGenerations.slice(-5)
      }
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// --- PayPal IPN (paiements "biens & services") ---
// URL à configurer dans PayPal : https://TON-BACKEND-DOMAIN/paypal/ipn
// et définir PAYPAL_EMAIL dans .env avec ton adresse PayPal
app.post('/paypal/ipn', (req, res) => {
  // PayPal demande une réponse rapide
  res.status(200).end();

  const params = req.body || {};
  // Reconstruit le corps avec le paramètre spécial
  const verificationBody = 'cmd=_notify-validate&' + querystring.stringify(params);

  const options = {
    host: process.env.NODE_ENV === 'production' ? 'ipnpb.paypal.com' : 'ipnpb.sandbox.paypal.com',
    method: 'POST',
    path: '/cgi-bin/webscr',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(verificationBody)
    }
  };

  const paypalReq = https.request(options, (paypalRes) => {
    let body = '';
    paypalRes.on('data', (chunk) => { body += chunk; });
    paypalRes.on('end', () => {
      const isVerified = body === 'VERIFIED';

      if (!isVerified) {
        console.warn('IPN non vérifié:', body, params);
        return;
      }

      const receiver = (params.receiver_email || params.business || '').toLowerCase();
      const expected = (process.env.PAYPAL_EMAIL || '').toLowerCase();

      if (!expected || receiver !== expected) {
        console.warn('IPN ignoré: mauvais receiver_email', receiver);
        return;
      }

      if (params.payment_status !== 'Completed') {
        console.warn('IPN statut non complété:', params.payment_status);
        return;
      }

      // À partir d'ici, le paiement est considéré comme valide
      // Tu peux lier params.custom ou params.invoice à une commande interne
      console.log('✅ Paiement PayPal IPN validé:', {
        txn_id: params.txn_id,
        payer_email: params.payer_email,
        gross: params.mc_gross,
        currency: params.mc_currency,
        custom: params.custom,
        invoice: params.invoice
      });
      try {
        const memo = params.memo || '';
        const custom = params.custom || '';
        const invoice = params.invoice || '';
        const gross = String(params.mc_gross || '');
        const curr = String(params.mc_currency || '');

        let order = orders.find(o => o.orderId && (o.orderId === custom || o.orderId === invoice || (memo && memo.includes(o.orderId))));
        if (!order) {
          order = orders.find(o => o.status === 'pending' && o.total === gross && o.currency.toUpperCase() === curr.toUpperCase());
        }
        if (order) {
          order.status = 'paid';
          order.txn_id = params.txn_id;
          order.payer_email = params.payer_email;
          order.paidAt = new Date().toISOString();
          saveOrders();
          console.log('💸 Ordre marqué payé:', order.orderId);
        } else {
          console.warn('Aucun ordre correspondant trouvé pour IPN.');
        }
      } catch(e) {
        console.error('Erreur association ordre/IPN:', e);
      }
    });
  });

  paypalReq.on('error', (err) => {
    console.error('Erreur vérification IPN PayPal:', err);
  });

  paypalReq.write(verificationBody);
  paypalReq.end();
});

// Fonction utilitaire pour parser les comptes
function parseAccount(accountString) {
  if (typeof accountString !== 'string') return accountString;
  
  const parts = accountString.split(':');
  
  if (parts.length >= 2) {
    const result = {
      email: parts[0].includes('@') ? parts[0] : null,
      username: !parts[0].includes('@') ? parts[0] : null,
      password: parts[1]
    };
    
    if (parts.length > 2) {
      result.additionalData = parts.slice(2).join(':');
    }
    
    return result;
  }
  
  return { raw: accountString };
}

// WebSocket simple
io.on('connection', (socket) => {
  console.log('Utilisateur connecté via WebSocket');
  
  socket.on('disconnect', () => {
    console.log('Utilisateur déconnecté');
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur'
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

// Démarrage du serveur
async function startServer() {
  try {
    await loadUsers();
    await loadOrders();
    
    server.listen(PORT, () => {
      console.log('🚀 Novaxell Premium démarré !');
      console.log(`📡 Serveur: http://localhost:${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`👥 Utilisateurs chargés: ${users.length}`);
      console.log('');
      console.log('🔑 Codes par défaut:');
      console.log('   • Utilisateur: NOVA-USER123');
      console.log('   • Admin: NOVA-ADMIN (mot de passe: admin123)');
      console.log('');
      console.log('✨ Prêt à générer des comptes premium !');
    });
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

startServer();
