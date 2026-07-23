# 📋 Résumé du déploiement SDK Scheme Adapter pour CMCOTONOU

## ✅ Ce qui a été configuré

### 1. Configuration du déploiement

- **Répertoire**: `/opt/tools/sdk-scheme-adapter/deploy/`
- **DFSP ID**: `CMCOTONOU`
- **Hub Mojaloop**: Kubernetes @ 192.168.0.154
- **Protocole**: HTTPS avec mTLS requis

### 2. Services à déployer

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| sdk-scheme-adapter | mojaloop/sdk-scheme-adapter:v23.1.3 | 4000, 4001 | Interface hub Mojaloop |
| redis | redis:6.2.4-alpine | 6379 | Cache transactions |
| mock-dfsp-backend | mojaloop/sdk-mock-dfsp-backend | 3000 | Backend test (à remplacer) |

### 3. Endpoints configurés

**Vers le hub Mojaloop:**
- ALS: account-lookup-service.local:443
- Quotes: quoting-service.local:443
- Transfers: transfer-api-svc.local:443

**Exposés:**
- Inbound API (callbacks hub): Port 4000
- Outbound API (initier transferts): Port 4001

### 4. Fichiers créés

```
/opt/tools/sdk-scheme-adapter/deploy/
├── production.env              # Configuration principale
├── docker-compose.yml          # Définition services Docker
├── README.md                   # Guide complet (9.6K)
├── QUICKSTART.md               # Démarrage rapide
├── CERTIFICATES.md             # Guide certificats TLS
├── check-prerequisites.sh      # Script de vérification
├── manage.sh                   # Script de gestion (start/stop/status)
├── .gitignore                  # Protection des secrets
└── secrets/tls/                # Répertoire certificats (vide pour l'instant)
```

## ⚠️ Actions requises avant déploiement

### CRITIQUE - Obtenir les certificats mTLS

Le hub Mojaloop **requiert mTLS**. Vous devez obtenir les certificats:

**Étape 1**: Contacter l'administrateur du hub Mojaloop

**Étape 2**: Demander:
- Certificat CA du hub (`ca.crt`)
- Certificat client pour CMCOTONOU (`client.crt` + `client.key`)
- Confirmation de l'enregistrement de CMCOTONOU dans le hub

**Étape 3**: Installer les certificats
```bash
cd /opt/tools/sdk-scheme-adapter/deploy
# Copier vos certificats dans secrets/tls/
cp /path/to/ca.crt secrets/tls/
cp /path/to/client.crt secrets/tls/
cp /path/to/client.key secrets/tls/
cp secrets/tls/client.crt secrets/tls/server.crt
cp secrets/tls/client.key secrets/tls/server.key

chmod 600 secrets/tls/*.key
chmod 644 secrets/tls/*.crt
```

📘 **Voir**: [CERTIFICATES.md](CERTIFICATES.md) pour le guide détaillé

### Configurer les endpoints callback dans le hub

L'administrateur du hub doit configurer les endpoints callback pour CMCOTONOU:

**Déterminer l'IP publique de ce serveur** (accessible depuis Kubernetes):
```bash
# IP du serveur (à adapter)
ip addr show | grep "inet " | grep -v 127.0.0.1
```

**Endpoints à configurer dans Connection Manager**:

Exemple si IP = `192.168.0.200`:
- PARTIES_PUT: `http://192.168.0.200:4000/parties/{{partyIdType}}/{{partyIdentifier}}`
- QUOTES_PUT: `http://192.168.0.200:4000/quotes/{{id}}`
- TRANSFERS_POST: `http://192.168.0.200:4000/transfers`
- TRANSFERS_PUT: `http://192.168.0.200:4000/transfers/{{id}}`

## 🚀 Déploiement - Étapes suivantes

### 1. Vérifier les prérequis

```bash
cd /opt/tools/sdk-scheme-adapter/deploy
./check-prerequisites.sh
```

### 2. Démarrer les services

```bash
./manage.sh start
```

### 3. Vérifier la santé

```bash
./manage.sh health
./manage.sh test
```

### 4. Tester un transfert

```bash
curl -X POST http://localhost:4001/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"idType": "MSISDN", "idValue": "22912345678"},
    "to": {"idType": "MSISDN", "idValue": "22987654321"},
    "amountType": "SEND",
    "currency": "XOF",
    "amount": "1000",
    "transactionType": "TRANSFER",
    "homeTransactionId": "test-001"
  }'
```

## 📚 Documentation

| Fichier | Description |
|---------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Démarrage rapide en 3 étapes |
| [README.md](README.md) | Guide complet de déploiement |
| [CERTIFICATES.md](CERTIFICATES.md) | Obtention et configuration certificats |

## 🔒 Sécurité - Checklist

Avant la production:
- [ ] Certificats TLS obtenus et installés
- [ ] Permissions des clés privées: 600
- [ ] `.gitignore` configuré (secrets non commitables)
- [ ] `ILP_SECRET` changé (valeur par défaut non sécurisée!)
- [ ] CMCOTONOU enregistré dans le hub
- [ ] Endpoints callback configurés
- [ ] Pare-feu configuré (ports 4000, 4001 accessibles depuis le hub)
- [ ] Monitoring configuré

## 🛠️ Commandes utiles

```bash
# Gestion des services
./manage.sh start      # Démarrer
./manage.sh stop       # Arrêter
./manage.sh restart    # Redémarrer
./manage.sh status     # État
./manage.sh health     # Santé
./manage.sh logs       # Logs
./manage.sh test       # Tests

# Logs détaillés
docker-compose logs -f sdk-scheme-adapter

# Entrer dans le container
docker exec -it sdk-scheme-adapter sh

# Inspecter Redis
docker exec -it sdk-redis redis-cli
```

## 🔧 Prochaines étapes après déploiement réussi

1. **Remplacer le mock backend** par votre vrai backend DFSP
2. **Implémenter l'API Inbound** dans votre backend
3. **Configurer le monitoring** (Prometheus, Grafana)
4. **Tests end-to-end** avec le hub Mojaloop
5. **Formation de l'équipe** sur l'utilisation
6. **Déployer les autres outils** (ml-mcm-agent, etc.)

## 📞 Support

- **Documentation Mojaloop**: https://docs.mojaloop.io/
- **SDK Scheme Adapter GitHub**: https://github.com/mojaloop/sdk-scheme-adapter
- **Issues**: https://github.com/mojaloop/sdk-scheme-adapter/issues

## 📌 Informations de configuration

```bash
# Afficher la configuration
cat production.env | grep -v "^#" | grep -v "^$"

# Vérifier les endpoints
cat production.env | grep ENDPOINT

# Vérifier l'ID DFSP
cat production.env | grep DFSP_ID
```

---

**Date de création**: $(date '+%Y-%m-%d %H:%M')  
**Serveur**: $(hostname)  
**Répertoire**: /opt/tools/sdk-scheme-adapter/deploy/
