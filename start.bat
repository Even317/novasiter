@echo off
echo ========================================
echo    NOVAXELL PREMIUM - DEMARRAGE
echo ========================================
echo.
echo Installation des dependances...
call npm install
echo.
echo Demarrage du serveur...
echo.
echo ========================================
echo    SERVEUR DEMARRE AVEC SUCCES!
echo ========================================
echo.
echo PAGE D'ACCUEIL: http://localhost:3000/landing.html
echo GENERATEUR: http://localhost:3000
echo.
echo CODES D'ACCES:
echo - Utilisateur: NOVA-USER123
echo - Admin: NOVA-ADMIN (mdp: admin123)
echo.
echo NOUVELLES FONCTIONNALITES:
echo - Page d'accueil professionnelle
echo - Guide installation iOS
echo - Tests de comptes avances
echo - Support 24/7
echo - Securite renforcee
echo.
echo ========================================
echo.
node server-simple.js
pause
