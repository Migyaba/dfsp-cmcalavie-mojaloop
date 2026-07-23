# Guide de déploiement du SDK Scheme Adapter pour CMCOTONOU

Ce guide vous accompagne dans le déploiement du SDK Scheme Adapter pour connecter CMCOTONOU au hub Mojaloop déployé sur Kubernetes.

## Vue d'ensemble

Le SDK Scheme Adapter sert d'interface entre:
- **Votre backend DFSP** (système interne de gestion de comptes)
- **Le hub Mojaloop** (réseau de paiements interopérables)

```
[Backend DFSP] <--HTTP--> [SDK Scheme Adapter] <--HTTPS/mTLS--> [Hub Mojaloop]
```

## Architecture déployée

- **SDK Scheme Adapter**: Interface principale avec le hub Mojaloop
- **Redis**: Cache pour stocker les états des transactions
- **Mock DFSP Backend**: Backend de test (à remplacer par votre vrai backend)

## Configuration actuelle

### Hub Mojaloop
- **LoadBalancer IP**: 192.168.0.154
- **Protocol**: HTTPS avec mTLS requis
- **Services**:
  - ALS: account-lookup-service.local:443
  - Quotes: quoting-service.local:443
  - Transfers: transfer-api-svc.local:443

### DFSP
- **ID**: CMCOTONOU
- **Currencies supportées**: USD, XOF, EUR
- **Auto-accept quotes**: false (confirmation manuelle requise)

## Étape 1: Obtenir les certificats TLS/mTLS

⚠️ **CRITIQUE**: Le hub Mojaloop requiert mTLS. Vous devez obtenir les certificats auprès de l'administrateur du hub.

### Certificats nécessaires

Contactez l'administrateur du hub Mojaloop pour obtenir:

1. **Certificat CA** (`ca.crt`): Autorité de certification du hub
2. **Certificat client** (`client.crt` + `client.key`): Pour authentifier CMCOTONOU
3. **Confirmation**: Que CMCOTONOU est enregistré dans le hub

### Installation des certificats

```bash
# Placer vos certificats dans le répertoire secrets/tls/
cd /opt/tools/sdk-scheme-adapter/deploy

# Copier vos certificats (adaptez les chemins)
sudo cp /chemin/vers/mojaloop-ca.crt secrets/tls/ca.crt
sudo cp /chemin/vers/cmcotonou-client.crt secrets/tls/client.crt
sudo cp /chemin/vers/cmcotonou-client.key secrets/tls/client.key
sudo cp secrets/tls/client.crt secrets/tls/server.crt
sudo cp secrets/tls/client.key secrets/tls/server.key

# Sécuriser les permissions
sudo chmod 600 secrets/tls/*.key
sudo chmod 644 secrets/tls/*.crt
sudo chown -R russel:russel secrets/
```

## Étape 2: Enregistrement dans le hub Mojaloop

CMCOTONOU doit être enregistré dans le hub avec ses endpoints callback.

### Via Connection Manager (recommandé)

1. Accéder à https://connection-manager.mojaloop.local
2. Créer un nouveau DFSP: ID = `CMCOTONOU`
3. Configurer les endpoints callback (voir section Endpoints ci-dessous)
4. Activer les devises: USD, XOF, EUR

### Endpoints callback à configurer

Déterminez l'IP publique de ce serveur accessible depuis le cluster Kubernetes.

Si l'IP est `192.168.0.200` par exemple, configurez:

| Type | URL |
|------|-----|
| PARTIES_PUT | http://192.168.0.200:4000/parties/{{partyIdType}}/{{partyIdentifier}} |
| PARTIES_PUT_ERROR | http://192.168.0.200:4000/parties/{{partyIdType}}/{{partyIdentifier}}/error |
| QUOTES_PUT | http://192.168.0.200:4000/quotes/{{id}} |
| QUOTES_PUT_ERROR | http://192.168.0.200:4000/quotes/{{id}}/error |
| TRANSFERS_POST | http://192.168.0.200:4000/transfers |
| TRANSFERS_PUT | http://192.168.0.200:4000/transfers/{{id}} |
| TRANSFERS_PUT_ERROR | http://192.168.0.200:4000/transfers/{{id}}/error |

⚠️ Remplacez `192.168.0.200` par l'IP réelle du serveur.

## Étape 3: Vérification des prérequis

```bash
cd /opt/tools/sdk-scheme-adapter/deploy
./check-prerequisites.sh
```

Ce script vérifie:
- Docker et Docker Compose installés
- Fichiers de configuration présents
- Certificats TLS présents et permissions correctes
- Connectivité vers le hub Mojaloop (192.168.0.154)
- Ports disponibles

## Étape 4: Déploiement

### Démarrer les services

```bash
cd /opt/tools/sdk-scheme-adapter/deploy

# Méthode 1: Avec le script de gestion
./manage.sh start

# Méthode 2: Directement avec docker-compose
docker-compose up -d
```

### Vérifier le statut

```bash
# Avec le script
./manage.sh status

# Ou directement
docker-compose ps
```

Tous les services doivent afficher "Up" et "healthy".

### Voir les logs

```bash
# Tous les logs
./manage.sh logs

# Logs du SDK Scheme Adapter uniquement
./manage.sh logs -f sdk-scheme-adapter

# Logs de tous les services en temps réel
docker-compose logs -f
```

## Étape 5: Tests de connectivité

### Test automatique

```bash
./manage.sh health
./manage.sh test
```

### Test manuel - Health check

```bash
curl http://localhost:4001/health
```

Réponse attendue:
```json
{
  "status": "OK"
}
```

### Test manuel - Lookup de participant

```bash
curl -X GET "http://localhost:4001/parties/MSISDN/123456789" \
  -H "Content-Type: application/json"
```

Ce test vérifie:
1. Le SDK peut recevoir la requête
2. Le SDK peut communiquer avec le hub Mojaloop (ALS)
3. Les certificats mTLS fonctionnent
4. Le hub peut répondre

### Test manuel - Transfert sortant

```bash
curl -X POST "http://localhost:4001/transfers" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {
      "displayName": "Test Sender CMCOTONOU",
      "idType": "MSISDN",
      "idValue": "22912345678"
    },
    "to": {
      "idType": "MSISDN",
      "idValue": "22987654321"
    },
    "amountType": "SEND",
    "currency": "XOF",
    "amount": "1000",
    "transactionType": "TRANSFER",
    "note": "Test de transfert",
    "homeTransactionId": "test-tx-001"
  }'
```

## Étape 6: Intégration avec votre backend DFSP

Le mock backend (`sdk-mock-backend`) est utilisé pour les tests. Pour la production:

### 1. Remplacer le mock backend

Modifiez `docker-compose.yml` pour pointer vers votre vrai backend, ou configurez:

```env
BACKEND_ENDPOINT=http://votre-backend-dfsp:PORT
```

dans `production.env`.

### 2. Implémenter l'API Inbound

Votre backend doit implémenter l'API DFSP Inbound pour recevoir les transferts entrants:

- `PUT /quoterequests/{ID}`: Recevoir une demande de quote
- `PUT /transfers/{ID}`: Recevoir un transfert entrant

Documentation: https://github.com/mojaloop/sdk-scheme-adapter/blob/master/docs/dfspInboundApi.yaml

### 3. Utiliser l'API Outbound

Pour initier des transferts sortants depuis votre backend:

```bash
POST http://sdk-scheme-adapter:4001/transfers
```

Documentation: https://github.com/mojaloop/api-snippets/

## Commandes utiles

### Gestion des services

```bash
./manage.sh start      # Démarrer
./manage.sh stop       # Arrêter
./manage.sh restart    # Redémarrer
./manage.sh status     # État
./manage.sh logs       # Logs
./manage.sh health     # Santé
./manage.sh test       # Tests
```

### Debugging

```bash
# Voir les logs en temps réel
docker-compose logs -f sdk-scheme-adapter

# Entrer dans le container
docker exec -it sdk-scheme-adapter sh

# Tester la connectivité depuis le container
docker exec sdk-scheme-adapter ping 192.168.0.154
docker exec sdk-scheme-adapter nslookup account-lookup-service.local
```

### Inspecter Redis

```bash
# Se connecter à Redis
docker exec -it sdk-redis redis-cli

# Voir toutes les clés
KEYS *

# Voir une valeur
GET key_name
```

## Monitoring en production

### Logs

Les logs sont gérés par Docker. Pour une production robuste:

```bash
# Configurer la rotation des logs dans docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Métriques

Le SDK expose des métriques (si configuré). Considérez:
- Prometheus pour collecter les métriques
- Grafana pour visualiser

### Alertes

Surveillez:
- Santé du service (`/health` endpoint)
- Taux d'échec des transferts
- Latence vers le hub Mojaloop
- Utilisation de Redis

## Dépannage

### Erreur: "unable to verify certificate"

**Cause**: Certificat CA incorrect ou chaîne incomplète

**Solution**:
```bash
# Vérifier le certificat CA
openssl x509 -in secrets/tls/ca.crt -text -noout

# Vérifier que le certificat client est signé par cette CA
openssl verify -CAfile secrets/tls/ca.crt secrets/tls/client.crt
```

### Erreur: "Connection refused to 192.168.0.154:443"

**Cause**: Problème réseau ou pare-feu

**Solution**:
```bash
# Tester la connectivité
telnet 192.168.0.154 443

# Vérifier les règles de pare-feu
sudo iptables -L -n | grep 443

# Vérifier depuis le container
docker exec sdk-scheme-adapter nc -zv 192.168.0.154 443
```

### Erreur: "Participant not found"

**Cause**: CMCOTONOU non enregistré dans le hub

**Solution**: Vérifier l'enregistrement via Connection Manager

### SDK ne démarre pas

**Cause**: Configuration incorrecte ou certificats manquants

**Solution**:
```bash
# Voir les logs détaillés
docker-compose logs sdk-scheme-adapter | tail -50

# Vérifier la configuration
docker-compose config

# Activer les logs debug
# Dans production.env: LOG_LEVEL=debug
docker-compose restart sdk-scheme-adapter
```

## Sécurité - Checklist production

- [ ] ILP_SECRET changé (ne pas utiliser la valeur par défaut!)
- [ ] Certificats TLS avec permissions 600 pour les .key
- [ ] Pare-feu configuré (seulement ports nécessaires ouverts)
- [ ] Monitoring et alertes actifs
- [ ] Backups Redis configurés
- [ ] Rotation des logs active
- [ ] Variables sensibles non commitées dans Git
- [ ] Accès SSH sécurisé au serveur
- [ ] Mise à jour régulière des images Docker

## Support

- **Documentation Mojaloop**: https://docs.mojaloop.io/
- **SDK Scheme Adapter GitHub**: https://github.com/mojaloop/sdk-scheme-adapter
- **Issues**: https://github.com/mojaloop/sdk-scheme-adapter/issues

## Prochaines étapes

1. ✅ Déployer le SDK Scheme Adapter
2. ⬜ Implémenter votre backend DFSP avec l'API Inbound
3. ⬜ Tester des transferts end-to-end
4. ⬜ Configurer le monitoring en production
5. ⬜ Former votre équipe sur l'utilisation
6. ⬜ Déployer les autres outils (ml-mcm-agent, etc.)
