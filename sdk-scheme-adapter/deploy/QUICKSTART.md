# Démarrage rapide - SDK Scheme Adapter

Guide minimal pour déployer rapidement le SDK Scheme Adapter.

## Prérequis en 30 secondes

```bash
cd /opt/tools/sdk-scheme-adapter/deploy
./check-prerequisites.sh
```

## Déploiement en 3 étapes

### 1. Obtenir les certificats

⚠️ **BLOQUANT**: Contactez l'administrateur du hub Mojaloop pour obtenir:
- `ca.crt`
- `client.crt` + `client.key` pour CMCOTONOU

Placez-les dans `secrets/tls/`:

```bash
# Exemple (adaptez les chemins)
cp /path/to/ca.crt secrets/tls/
cp /path/to/client.crt secrets/tls/
cp /path/to/client.key secrets/tls/
cp secrets/tls/client.crt secrets/tls/server.crt
cp secrets/tls/client.key secrets/tls/server.key

chmod 600 secrets/tls/*.key
chmod 644 secrets/tls/*.crt
```

### 2. Vérifier la configuration

```bash
cat production.env | grep -E "DFSP_ID|ALS_ENDPOINT|QUOTES_ENDPOINT|TRANSFERS_ENDPOINT"
```

Devrait afficher:
```
DFSP_ID=CMCOTONOU
ALS_ENDPOINT=account-lookup-service.local:443
QUOTES_ENDPOINT=quoting-service.local:443
TRANSFERS_ENDPOINT=transfer-api-svc.local:443
```

### 3. Démarrer

```bash
./manage.sh start
```

## Vérification rapide

```bash
# Santé des services
./manage.sh health

# Test de connectivité
curl http://localhost:4001/health

# Test de lookup (remplacez le numéro)
curl http://localhost:4001/parties/MSISDN/22912345678
```

## En cas de problème

### Voir les logs

```bash
./manage.sh logs -f sdk-scheme-adapter
```

### Erreurs courantes

**"unable to verify certificate"**
→ Vérifiez que `ca.crt` est correct: `openssl verify -CAfile secrets/tls/ca.crt secrets/tls/client.crt`

**"Connection refused to 192.168.0.154:443"**
→ Vérifiez la connectivité: `ping 192.168.0.154` et `telnet 192.168.0.154 443`

**"Participant not found"**
→ CMCOTONOU n'est pas enregistré dans le hub. Contactez l'administrateur.

### Redémarrer proprement

```bash
./manage.sh stop
./manage.sh start
```

## Endpoints exposés

| Port | Service | Description |
|------|---------|-------------|
| 3000 | Mock Backend | Backend DFSP de test |
| 4000 | Inbound API | Reçoit les callbacks du hub |
| 4001 | Outbound API | Initier des transferts |
| 6379 | Redis | Cache des transactions |

## Test de transfert sortant

```bash
curl -X POST http://localhost:4001/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "from": {
      "displayName": "Test CMCOTONOU",
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
    "note": "Test transfer",
    "homeTransactionId": "'$(uuidgen)'"
  }'
```

## Documentation complète

- [README.md](README.md) - Guide complet de déploiement
- [CERTIFICATES.md](CERTIFICATES.md) - Guide des certificats TLS
- [production.env](production.env) - Configuration détaillée

## Configuration du hub (à faire par l'admin)

L'administrateur du hub Mojaloop doit configurer:

1. **Enregistrer CMCOTONOU** dans le hub (DFSP_ID=CMCOTONOU)
2. **Configurer les endpoints callback** vers ce serveur:
   - IP du serveur: `[À déterminer]`
   - Port inbound: `4000`
   - Exemple: `http://192.168.0.200:4000/parties/{Type}/{ID}`

## Commandes essentielles

```bash
./manage.sh start      # Démarrer
./manage.sh stop       # Arrêter
./manage.sh status     # État
./manage.sh health     # Santé
./manage.sh logs       # Logs
./manage.sh test       # Tests
```

## Next steps

Après vérification que tout fonctionne:
1. Remplacer le mock backend par votre vrai backend DFSP
2. Implémenter l'API Inbound dans votre backend
3. Configurer le monitoring en production
4. Changer `ILP_SECRET` dans production.env (valeur par défaut non sécurisée!)

## Support

En cas de problème, vérifier:
1. Les logs: `./manage.sh logs -f sdk-scheme-adapter`
2. La connectivité: `./manage.sh test`
3. Les certificats: `openssl verify -CAfile secrets/tls/ca.crt secrets/tls/client.crt`
4. Consulter la documentation Mojaloop: https://docs.mojaloop.io/
