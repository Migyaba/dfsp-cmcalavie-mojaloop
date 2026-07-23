# Guide d'obtention et configuration des certificats TLS/mTLS

## Pourquoi mTLS est requis?

Le hub Mojaloop utilise mTLS (mutual TLS) pour:
- Authentifier chaque DFSP participant
- Chiffrer les communications
- Assurer la sécurité du réseau de paiements

## Certificats nécessaires

### 1. Certificat CA (Certificate Authority)

**Fichier**: `secrets/tls/ca.crt`  
**Description**: Certificat racine de l'autorité de certification du hub Mojaloop  
**Utilisation**: Valider les certificats serveurs du hub

### 2. Certificat client CMCOTONOU

**Fichiers**: 
- `secrets/tls/client.crt` (certificat public)
- `secrets/tls/client.key` (clé privée)

**Description**: Certificat unique pour CMCOTONOU signé par la CA du hub  
**Utilisation**: Authentifier CMCOTONOU auprès du hub

### 3. Certificat serveur (optionnel)

**Fichiers**:
- `secrets/tls/server.crt` 
- `secrets/tls/server.key`

**Description**: Pour recevoir les callbacks du hub  
**Note**: Peut être identique au certificat client

## Comment obtenir les certificats?

### Étape 1: Contacter l'administrateur du hub

Contactez l'administrateur du hub Mojaloop (probablement l'équipe qui gère le cluster Kubernetes) et demandez:

1. **Certificat CA du hub**: `ca.crt`
2. **CSR (Certificate Signing Request)** ou demande de génération de certificat pour CMCOTONOU
3. **Instructions spécifiques** de leur procédure d'onboarding

### Étape 2: Générer une CSR (si demandé)

Si l'administrateur vous demande de générer une CSR:

```bash
# Générer une clé privée
openssl genrsa -out client.key 2048

# Générer la CSR
openssl req -new -key client.key -out cmcotonou.csr \
  -subj "/C=BJ/ST=Littoral/L=Cotonou/O=CMCOTONOU/OU=IT/CN=cmcotonou.mojaloop.local"

# Envoyer cmcotonou.csr à l'administrateur du hub
# Ils vous renverront client.crt signé
```

Adaptez les valeurs:
- `C`: Code pays (BJ pour Bénin)
- `ST`: État/Province
- `L`: Ville (Cotonou)
- `O`: Organisation (CMCOTONOU)
- `CN`: Common Name (doit être unique et approuvé par le hub)

### Étape 3: Recevoir les certificats signés

L'administrateur vous renverra:
- `client.crt`: Votre certificat signé
- `ca.crt`: Le certificat CA du hub (si pas encore fourni)
- Éventuellement la chaîne complète de certificats

### Étape 4: Installer les certificats

```bash
cd /opt/tools/sdk-scheme-adapter/deploy

# Créer le répertoire
mkdir -p secrets/tls

# Copier les certificats reçus
cp /chemin/vers/ca.crt secrets/tls/ca.crt
cp /chemin/vers/client.crt secrets/tls/client.crt
cp /chemin/vers/client.key secrets/tls/client.key

# Pour le serveur, utiliser les mêmes certificats
cp secrets/tls/client.crt secrets/tls/server.crt
cp secrets/tls/client.key secrets/tls/server.key

# Permissions de sécurité
chmod 644 secrets/tls/*.crt
chmod 600 secrets/tls/*.key
```

## Validation des certificats

### Vérifier le certificat CA

```bash
openssl x509 -in secrets/tls/ca.crt -text -noout
```

Vérifiez:
- Issuer: Doit correspondre au hub Mojaloop
- Validity: Dates de validité (Not Before / Not After)

### Vérifier le certificat client

```bash
openssl x509 -in secrets/tls/client.crt -text -noout
```

Vérifiez:
- Subject: Doit contenir CMCOTONOU ou vos informations
- Issuer: Doit correspondre à la CA du hub
- Validity: Dates de validité

### Vérifier que le certificat client est signé par la CA

```bash
openssl verify -CAfile secrets/tls/ca.crt secrets/tls/client.crt
```

Résultat attendu: `client.crt: OK`

### Vérifier la correspondance clé privée / certificat

```bash
# Hash du module de la clé privée
openssl rsa -in secrets/tls/client.key -modulus -noout | openssl md5

# Hash du module du certificat
openssl x509 -in secrets/tls/client.crt -modulus -noout | openssl md5
```

Les deux hash doivent être identiques.

## Structure finale

```
secrets/tls/
├── ca.crt           # Certificat CA du hub Mojaloop
├── client.crt       # Certificat client CMCOTONOU (public)
├── client.key       # Clé privée CMCOTONOU (CONFIDENTIEL!)
├── server.crt       # Certificat serveur (copie de client.crt)
└── server.key       # Clé serveur (copie de client.key)
```

## Sécurité

⚠️ **IMPORTANT - Sécurité des clés privées**:

1. **Permissions**: `chmod 600 *.key` (lecture/écriture propriétaire uniquement)
2. **Ne JAMAIS commiter** les .key dans Git
3. **Backup sécurisé** des clés dans un coffre-fort sécurisé
4. **Rotation régulière** (avant expiration du certificat)
5. **Révocation immédiate** si compromis

### Ajouter au .gitignore

```bash
echo "secrets/tls/*.key" >> .gitignore
echo "secrets/tls/*.crt" >> .gitignore
```

## Renouvellement

Les certificats ont une durée de validité limitée (généralement 1 an).

### Vérifier la date d'expiration

```bash
openssl x509 -in secrets/tls/client.crt -noout -enddate
```

### Renouveler avant expiration

1. Contacter l'administrateur du hub 30-60 jours avant expiration
2. Générer une nouvelle CSR (ou réutiliser l'ancienne clé)
3. Recevoir le nouveau certificat signé
4. Tester avec le nouveau certificat
5. Remplacer l'ancien certificat
6. Redémarrer le SDK Scheme Adapter

```bash
# Après remplacement des certificats
docker-compose restart sdk-scheme-adapter
```

## Troubleshooting

### Erreur: "unable to get local issuer certificate"

**Cause**: Le certificat CA est manquant ou incorrect

**Solution**: 
```bash
# Vérifier que ca.crt contient toute la chaîne
cat secrets/tls/ca.crt

# Si plusieurs CA dans la chaîne, concaténer:
cat intermediate-ca.crt root-ca.crt > ca.crt
```

### Erreur: "certificate verify failed"

**Cause**: Le certificat client n'est pas signé par la CA fournie

**Solution**:
```bash
# Tester la vérification
openssl verify -CAfile secrets/tls/ca.crt secrets/tls/client.crt

# Si échec, obtenir le bon ca.crt de l'administrateur
```

### Erreur: "key values mismatch"

**Cause**: La clé privée ne correspond pas au certificat

**Solution**: 
```bash
# Vérifier les hashs
openssl rsa -in secrets/tls/client.key -modulus -noout | openssl md5
openssl x509 -in secrets/tls/client.crt -modulus -noout | openssl md5

# Obtenir la bonne paire clé/certificat
```

## Exemple de communication avec l'administrateur

**Email à envoyer à l'administrateur du hub Mojaloop:**

```
Objet: Demande de certificats mTLS pour onboarding CMCOTONOU

Bonjour,

Nous souhaitons connecter notre institution (CMCOTONOU) au hub Mojaloop.

Pourriez-vous nous fournir:
1. Le certificat CA racine du hub Mojaloop
2. Un certificat client signé pour CMCOTONOU (ou instructions pour générer une CSR)
3. Confirmation de l'enregistrement de CMCOTONOU (DFSP_ID=CMCOTONOU) dans le hub

Informations pour le certificat:
- Organisation: CMCOTONOU
- Common Name: cmcotonou.mojaloop.local (ou selon votre convention)
- Pays: Bénin (BJ)
- Devises: USD, XOF, EUR

Endpoints callback de CMCOTONOU:
- IP serveur: [VOTRE_IP]
- Inbound API: http://[VOTRE_IP]:4000

Merci de nous indiquer également:
- Le format de certificat attendu (PEM, DER, etc.)
- La durée de validité des certificats
- La procédure de renouvellement

Cordialement,
[Votre nom]
```

## Checklist de validation

Avant de déployer, vérifiez:

- [ ] Fichier `ca.crt` présent et valide
- [ ] Fichier `client.crt` présent et valide
- [ ] Fichier `client.key` présent avec permissions 600
- [ ] Certificat client vérifié avec la CA: `openssl verify -CAfile ca.crt client.crt`
- [ ] Correspondance clé/certificat validée (hashs identiques)
- [ ] Fichiers copiés également en `server.crt` et `server.key`
- [ ] Dates de validité vérifiées (certificats non expirés)
- [ ] `.gitignore` configuré pour ne pas commiter les certificats

✅ Si tout est OK, vous pouvez procéder au déploiement!
