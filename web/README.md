# NextPM Web Monitor

Interface web moderne pour monitorer le capteur NextPM via XIAO ESP32-S3.

## 🌟 Fonctionnalités

### Vue Utilisateur (Light Mode)
Interface conviviale pour l'utilisateur final:
- **Indicateur de qualité d'air** avec code couleur EPA
- **Graphique circulaire AQI** basé sur PM2.5
- **Température et humidité** en temps réel
- **Barres PM** pour PM1.0, PM2.5, PM10
- **Distribution BINS** (5 tailles de particules)
- **Graphique temporel** avec historique PM
- **Auto-refresh** toutes les 10 secondes
- Sélection de la fréquence d'échantillonnage (10s, 1m, 15m)

### Vue Technique (Pro Mode)
Interface avancée pour le développement et le débogage:
- **Informations capteur** complètes (FW versions, état, uptime)
- **Commandes rapides** pré-configurées
- **Commande personnalisée** pour tests manuels
- **Affichage données brutes** en temps réel avec JSON formaté
- **Logs de débogage** détaillés avec filtrage par niveau
- **Graphiques avancés** pour analyse approfondie
- **Statistiques** de communication (commandes, erreurs, checksums)

## 🚀 Utilisation

### Prérequis

- **Navigateur compatible Web Serial API**:
  - Chrome 89+ ✅
  - Edge 89+ ✅
  - Opera 75+ ✅
  - Firefox ❌ (pas de support Web Serial API)
  - Safari ❌ (pas de support Web Serial API)

- **Firmware v1.0.0-prod** ou supérieur flashé sur XIAO ESP32-S3

- **Capteur NextPM** connecté et alimenté

### Lancement

1. **Ouvrir l'interface web**:
   ```bash
   # Option 1: Ouvrir directement le fichier
   # Double-cliquer sur index.html

   # Option 2: Servir via HTTP (recommandé)
   # Python 3
   python -m http.server 8000
   # Puis ouvrir: http://localhost:8000

   # Node.js
   npx http-server -p 8000
   # Puis ouvrir: http://localhost:8000
   ```

2. **Se connecter au capteur**:
   - Cliquer sur le bouton "Se connecter" (🔌)
   - Sélectionner le port série du XIAO ESP32-S3
   - L'indicateur de connexion passe au vert ●

3. **Naviguer entre les vues**:
   - **📊 Vue Utilisateur**: Pour consultation quotidienne
   - **🔧 Vue Technique**: Pour développement et debug

## 📊 Vue Utilisateur

### Indicateur de Qualité d'Air (AQI)

Basé sur l'EPA Air Quality Index:

| PM2.5 (µg/m³) | AQI | Niveau | Couleur |
|---------------|-----|--------|---------|
| 0-12 | 0-50 | Bon | 🟢 Vert |
| 12.1-35.4 | 51-100 | Modéré | 🟡 Jaune |
| 35.5-55.4 | 101-150 | Mauvais (sensibles) | 🟠 Orange |
| 55.5-150.4 | 151-200 | Mauvais | 🔴 Rouge |
| 150.5-250.4 | 201-300 | Très mauvais | 🟣 Violet |
| 250.5+ | 301-500 | Dangereux | 🟤 Marron |

### Barres PM

Visualisation comparative des 3 mesures de particules:
- **PM1.0**: Particules ultra-fines (< 1 µm)
- **PM2.5**: Particules fines (< 2.5 µm) - **Indicateur principal**
- **PM10**: Particules inhalables (< 10 µm)

### Distribution BINS

5 catégories de tailles (nécessite FW capteur >= 1047):
- **Bin 0**: 0.3-0.5 µm
- **Bin 1**: 0.5-1.0 µm
- **Bin 2**: 1.0-2.5 µm
- **Bin 3**: 2.5-5.0 µm
- **Bin 4**: 5.0-10 µm

### Graphique Temporel

- Affiche les 50 derniers points de mesure
- Rafraîchissement automatique toutes les 10 secondes
- Légendes interactives pour masquer/afficher les séries

## 🔧 Vue Technique

### Informations Capteur

Affiche en temps réel:
- **Firmware ESP32**: Version du firmware XIAO
- **Firmware NextPM**: Version du capteur (hex + decimal)
- **État capteur**: 0=Ready, autres=voir doc NextPM
- **Support BINS**: Oui (FW >= 1047) / Non
- **Uptime**: Temps écoulé depuis démarrage ESP32
- **Checksums**: Validation des trames UART

### Commandes Rapides

Boutons pré-configurés:
- **PING**: Test de connectivité
- **FW**: Version firmware capteur
- **STATE**: État du capteur
- **TRH**: Température et humidité
- **PM**: Particules (10s par défaut)
- **PM 1M**: Particules (moyenne 1 minute)
- **PM 15M**: Particules (moyenne 15 minutes)
- **BINS**: Distribution des tailles
- **SNAPSHOT**: Toutes les données

### Commande Personnalisée

Permet d'envoyer n'importe quelle commande:
```
Exemples:
RAW 0x17 6         → Frame firmware brute
RAW 0x14 8         → Frame TRH brute
PM 1M              → PM moyenne 1 minute
BINS 15M           → BINS moyenne 15 minutes
```

### Logs de Débogage

4 niveaux de logs:
- **INFO** 🔵: Informations générales
- **WARN** 🟡: Avertissements (checksum fails, timeouts)
- **ERROR** 🔴: Erreurs critiques
- **DEBUG** ⚪: Détails de communication (TX/RX)

Options:
- ☑️ Auto-scroll: Défilement automatique vers le bas
- **Effacer**: Vider tous les logs

## 🏗️ Architecture

### Fichiers

```
web/
├── index.html          # Structure HTML (interface 2 onglets)
├── styles.css          # Styles modernes et responsifs
├── kernel.js           # Kernel de communication Web Serial API
├── app.js              # Logique application (Pro + Light)
└── README.md           # Cette documentation
```

### Kernel (kernel.js)

Couche d'abstraction pour la communication série:

**Classe `NextPMKernel`**:
- `connect()`: Ouvre le port série
- `disconnect()`: Ferme le port série
- `sendCommand(cmd)`: Envoie une commande
- `sendAndWait(cmd, timeout)`: Envoie et attend réponse
- `getTRH()`: Récupère température/humidité
- `getPM(average)`: Récupère particules
- `getBINS(average)`: Récupère distribution BINS
- `getSnapshot(average)`: Récupère toutes les données

**Events**:
- `connect`: Connexion établie
- `disconnect`: Déconnexion
- `data`: Données reçues (raw + parsed JSON)
- `error`: Erreur de communication
- `log`: Message de log

### Application (app.js)

Logique métier et gestion UI:

**Modules**:
- **Connection Manager**: Gère connexion/déconnexion
- **Tab Manager**: Navigation entre vues
- **Data Handler**: Traite données JSON du capteur
- **Chart Manager**: Met à jour graphiques Chart.js
- **UI Updater**: Rafraîchit l'interface en temps réel
- **Auto-refresh**: Polling automatique toutes les 10s

## 🎨 Personnalisation

### Couleurs

Modifier les variables CSS dans `styles.css`:

```css
:root {
    --primary-color: #2196F3;    /* Bleu principal */
    --success-color: #4CAF50;    /* Vert succès */
    --error-color: #F44336;      /* Rouge erreur */
    /* ... */
}
```

### Fréquence Auto-refresh

Modifier dans `app.js`:

```javascript
// Ligne ~647
app.autoRefreshInterval = setInterval(() => {
    // ...
}, 10000); // 10 secondes → modifier ici
```

### Nombre de Points Historique

Modifier dans `app.js`:

```javascript
// Ligne ~18
data: {
    // ...
    maxHistoryPoints: 50  // 50 points → modifier ici
}
```

## 🐛 Débogage

### Le port série ne s'affiche pas

- Vérifier que le XIAO est bien branché (USB)
- Vérifier que le driver ESP32 est installé
- Essayer un autre câble USB (data, pas charge only)
- Redémarrer le navigateur

### "Web Serial API non supportée"

- Utiliser Chrome, Edge ou Opera (pas Firefox/Safari)
- Vérifier que vous êtes sur HTTPS ou localhost
- Mettre à jour le navigateur

### Données non reçues

- Vérifier la connexion dans la Vue Technique
- Regarder les logs de débogage (Pro mode)
- Vérifier que le firmware est bien v1.0.0-prod
- Vérifier le câblage UART du capteur NextPM

### BINS ne fonctionne pas

- Nécessite capteur NextPM FW >= 1047
- Vérifier dans Vue Technique > Support BINS
- Si "Non", c'est normal, le capteur ne supporte pas BINS

### Graphiques ne s'affichent pas

- Vérifier la console navigateur (F12)
- Chart.js doit être chargé (voir CDN dans index.html)
- Vérifier la connexion Internet (CDN)

## 📈 Améliorations Futures

Idées d'évolution:

- [ ] Export des données en CSV
- [ ] Alertes configurables (seuils PM)
- [ ] Enregistrement continu en localStorage
- [ ] Mode PWA (offline, installation)
- [ ] Comparaison multi-capteurs
- [ ] Notifications push navigateur
- [ ] Thème sombre/clair
- [ ] Multi-langue (i18n)

## 📝 Notes Techniques

### Web Serial API

- **Baudrate**: 115200 (configuré dans kernel.js)
- **Format**: 8N1 (8 data bits, no parity, 1 stop bit)
- **Protocole**: Ligne de texte terminée par `\n`
- **Timeout**: 5 secondes pour commandes standards, 10-15s pour BINS/SNAPSHOT

### Endianness

Le firmware utilise **swap endianness** (validé en production):
- Toujours utiliser les valeurs `*_swap` dans le JSON
- Les valeurs `*_doc` sont incorrectes (gardées pour debug)

### Checksums

Le firmware valide tous les checksums UART:
- `chk_ok: true` → Données fiables
- `chk_ok: false` → Corruption possible (BINS sur FW 1047 peut avoir ce bug cosmétique)

## 🔗 Liens

- **GitHub Repo**: https://github.com/david-ria/NEXTPM-ESP32-XIAO-S3-FW
- **Production Validation**: ../docs/PRODUCTION_VALIDATION.md
- **Build Instructions**: ../docs/BUILD.md
- **CHANGELOG**: ../CHANGELOG.md

---

**Version**: v1.0.0-prod
**License**: MIT
**Auteur**: David RIA
