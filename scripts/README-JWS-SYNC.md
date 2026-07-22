# Synchronisation JWS (CMCALAVI + GTO)

## Script principal

```bash
/opt/mojaloop/scripts/sync-jws-keys-vault.sh all --restart
```

- Lit `dfspJWS` + `peerJWSKeys` dans Vault (`dfsp-cmcalavi` / `dfsp-gto`)
- Met à jour `/opt/mojaloop/KEYS/public-keys-mcm/{DFSP}.pem` (validation Hub / ALS)
- Met à jour les secrets SDK CMCALAVI sur disque
- Pour GTO (répertoire `prisca`) : staging dans `/opt/mojaloop/KEYS/staging/GTO` puis copie via Docker root
- Redémarre `dfsp-mcm-agent` + conteneurs SDK Docker

## Cron recommandé (root ou russel)

```cron
*/30 * * * * /opt/mojaloop/scripts/sync-jws-keys-vault.sh all --restart >> /var/log/sync-jws-keys.log 2>&1
```

## Après rotation mcm-agent (~24 h)

Le cron ci-dessus évite le décalage manuel Hub ↔ SDK.

## Rebuild image SDK CMCALAVI (correctifs code)

Les changements dans `handlers.js`, `SdkServer.js`, `ControlAgent/index.js` nécessitent une image locale reconstruite :

```bash
cd /opt/cmcalavi/sdk-scheme-adapter
docker compose -f deploy/docker-compose.yml build sdk-scheme-adapter
docker compose -f deploy/docker-compose.yml up -d sdk-scheme-adapter
```

Sans rebuild, le script Vault + `--restart` suffit si **Vault `peerJWSKeys`** est aligné avec `/opt/mojaloop/KEYS/public-keys-mcm/`. Le script écrit désormais les `.pem` SDK à partir des clés **Hub** (pas les entrées Vault obsolètes) pour GTO/CMCALAVI.

Si l’inbound rejette encore la signature GTO alors que `GTO.pem` sur disque est correct : Vault CMCALAVI a souvent un `peerJWSKeys.GTO` périmé — corriger avec patch Vault (voir ops) ou rebuild SDK avec overlay disque dans `InboundServer/index.js`.

**Ne pas appeler** `POST /api/actions/recreate-jws` sauf rotation volontaire (régénère la clé propre du DFSP et désaligne le Hub).

## Erreur ALS 3105 sur `PUT /parties` (source GTO)

L’ALS lit `/opt/mojaloop/KEYS/public-keys-mcm/GTO.pem` (monté dans le pod). Si GTO signe via PM4ML/Vault avec une clé **différente** de ce fichier, l’ALS renvoie `invalid signature` **avant** que la requête n’atteigne CMCALAVI.

**Correctif immédiat :** aligner `GTO.pem` sur la clé publique **courante** dans Vault (`dfspJWS.publicKey`), puis redémarrer `moja-account-lookup-service` :

```bash
# fait par sync-jws-keys-vault.sh GTO (écrit Hub depuis Vault) + rollout ALS si besoin
/opt/mojaloop/scripts/sync-jws-keys-vault.sh GTO
kubectl -n mojaloop rollout restart deployment/moja-account-lookup-service
```

Copier aussi `GTO.pem` dans `deploy/secrets/jwsVerificationKeys/` côté CMCALAVI si `PM4ML_ENABLED=false`.

## Erreur QS 3105 sur `POST /quotes` (source CMCALAVI ou GTO)

Le **quoting-service** monte le même répertoire Hub (`/opt/mojaloop/KEYS/public-keys-mcm` → `/opt/app/secrets/jwsVerificationKeys/`).

- Si **CMCALAVI** signe avec `CMCALAVI_jws_private.pem` désaligné du Hub → QS rejette les `POST /quotes` **source CMCALAVI**.
- Aligner : `sync-jws-keys-vault.sh CMCALAVI` + vérifier `deploy/secrets/CMCALAVI_jws_private.pem` + `docker compose up -d --force-recreate sdk-scheme-adapter`.
- Puis : `kubectl -n mojaloop rollout restart deployment/moja-quoting-service`.
