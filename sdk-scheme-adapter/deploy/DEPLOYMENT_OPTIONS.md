# Guide: Utiliser le déploiement PM4ML existant vs nouveau déploiement

## 🔍 Constat

Vous avez **déjà** un déploiement PM4ML/ITK actif sur ce serveur:
- Container: `itk-mojaloop-connector` (SDK Scheme Adapter)
- Container: `itk-redis` (Cache)
- Container: `itk-core-connector` (Core connector)

## 🤔 Quelle approche choisir?

### Option 1: Utiliser le déploiement PM4ML existant ⭐ RECOMMANDÉ

**Avantages:**
- ✅ Déjà configuré et en cours d'exécution
- ✅ MCM Agent peut gérer automatiquement les certificats
- ✅ Pas de conflits de ports
- ✅ Architecture PM4ML complète (MCM + SDK + Core Connector)
- ✅ Interface graphique via MCM Agent TUI

**Ce que vous devez faire:**

1. **Vérifier la configuration existante**
```bash
# Voir les containers actifs
docker ps | grep itk

# Voir les logs du connector
docker logs itk-mojaloop-connector

# Vérifier la configuration
docker inspect itk-mojaloop-connector | grep -A 20 Env
```

2. **Déployer et configurer MCM Agent**
```bash
cd /opt/tools/ml-mcm-agent

# Créer le fichier de configuration
cp .env.example .env

# Éditer selon votre environnement
nano .env

# Démarrer MCM Agent et Vault
docker-compose up -d vault vault-init mcm-agent
```

3. **Utiliser MCM Agent pour gérer les certificats**
```bash
# Lancer l'interface TUI
npm run dev:tui

# Ou après build
./dist/cli.js
```

4. **Configurer CMCOTONOU via MCM Agent**
   - MCM Agent va générer les CSR
   - Soumettre au Connection Manager
   - Récupérer les certificats signés automatiquement
   - Configurer le SDK Scheme Adapter

**Certificats avec MCM Agent:**
- MCM Agent gère tout le cycle de vie
- Vous avez besoin de credentials OAuth pour MCM Server
- Les certificats sont stockés dans Vault
- Renouvellement automatique

---

### Option 2: Nouveau déploiement standalone

**Utilisez cette option SEULEMENT si:**
- ❌ Le déploiement PM4ML existant est pour un autre DFSP
- ❌ Vous voulez une instance séparée pour CMCOTONOU
- ❌ Vous ne voulez pas utiliser PM4ML/MCM

**Ce que vous devez faire:**

1. **Arrêter le déploiement existant** (si conflit)
```bash
docker stop itk-mojaloop-connector itk-redis itk-core-connector
```

2. **OU modifier les ports** dans `/opt/tools/sdk-scheme-adapter/deploy/docker-compose.yml`
```yaml
ports:
  - "14000:4000"  # Au lieu de 4000:4000
  - "14001:4001"  # Au lieu de 4001:4001
  - "16379:6379"  # Au lieu de 6379:6379
```

3. **Obtenir les certificats manuellement**
   - Contacter l'administrateur du hub
   - Obtenir ca.crt, client.crt, client.key
   - Les placer dans secrets/tls/
   - Configuration manuelle complète

**Certificats en mode standalone:**
- ⚠️ Vous devez les obtenir ET gérer manuellement
- ⚠️ Pas de renouvellement automatique
- ⚠️ Gestion manuelle de la configuration

---

## 🎯 Ma recommandation

### ✅ Utiliser Option 1 (PM4ML existant) parce que:

1. **Infrastructure déjà en place**
   - SDK Scheme Adapter déjà déployé
   - Redis déjà opérationnel
   - Pas besoin de nouveau déploiement

2. **MCM Agent simplifie la gestion des certificats**
   - Pas besoin d'obtenir manuellement les certificats
   - MCM Agent communique avec le Connection Manager
   - Génération automatique des CSR
   - Récupération automatique des certificats signés
   - Renouvellement automatique avant expiration

3. **Architecture PM4ML complète**
   - Conçu pour les DFSP
   - Meilleure gestion opérationnelle
   - Monitoring intégré
   - Interface TUI pour administration

---

## 📋 Prochaines étapes recommandées

### 1. Vérifier le déploiement existant

```bash
cd /opt/tools

# Trouver le projet source du déploiement ITK
find . -name "docker-compose.yml" -exec grep -l "itk-mojaloop-connector" {} \;

# Examiner la configuration
docker inspect itk-mojaloop-connector --format='{{json .Config.Env}}' | jq
```

### 2. Configurer MCM Agent

```bash
cd /opt/tools/ml-mcm-agent

# Configuration
cat > .env << 'EOF'
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info

# Vault configuration
VAULT_ENDPOINT=http://vault:8200
VAULT_AUTH_ROLE_ID_PATH=/vault/role-id
VAULT_AUTH_SECRET_ID_PATH=/vault/secret-id

# MCM Server (à adapter selon votre hub)
MCM_SERVER_ENDPOINT=https://connection-manager.mojaloop.local
EOF

# Démarrer
docker-compose up -d
```

### 3. Utiliser MCM Agent pour CMCOTONOU

```bash
# Lancer l'interface
npm run dev:tui

# Dans l'interface TUI:
# - Configurer DFSP_ID: CMCOTONOU
# - Configurer les endpoints du hub
# - Générer les CSR
# - Soumettre au Connection Manager
# - Récupérer les certificats signés
```

### 4. Vérifier la configuration

```bash
# Vérifier que les certificats sont dans Vault
docker exec vault vault kv list pki/

# Vérifier que le connector utilise les certificats
docker logs itk-mojaloop-connector | grep -i certificate
```

---

## ❓ Questions à clarifier

1. **Le déploiement ITK actuel est-il pour CMCOTONOU ou un autre DFSP?**
   - Si déjà pour CMCOTONOU → Juste configurer/vérifier
   - Si pour un autre DFSP → Besoin d'instance séparée

2. **Avez-vous accès au Connection Manager du hub Mojaloop?**
   - Si oui → MCM Agent peut tout gérer automatiquement
   - Si non → Certificats manuels nécessaires

3. **Préférez-vous l'approche PM4ML ou standalone?**
   - PM4ML → Gestion plus simple, automatisation
   - Standalone → Plus de contrôle manuel, plus complexe

---

## 📚 Documentation à consulter

- `/opt/tools/ml-mcm-agent/README.md` - Guide MCM Agent
- `/opt/tools/sdk-scheme-adapter/deploy/README.md` - Guide standalone
- Connection Manager documentation du hub Mojaloop

---

**En résumé:**
- **Avec MCM Agent**: Certificats gérés automatiquement, mais besoin de credentials OAuth/MCM
- **Sans MCM Agent**: Certificats à obtenir et gérer manuellement
- **Recommandation**: Utiliser le déploiement PM4ML existant + MCM Agent
