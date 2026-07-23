#!/bin/bash
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
ERRORS=0
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; ERRORS=$((ERRORS + 1)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo "--- Vérification des prérequis ---"
if command -v docker >/dev/null 2>&1; then log_success "Docker est installé"; else log_error "Docker n'est pas installé"; fi
if docker compose version >/dev/null 2>&1; then log_success "Docker Compose est installé"; else log_error "Docker Compose n'est pas installé"; fi
for f in docker-compose.yml .env; do
    if [ -f "$f" ]; then log_success "Fichier $f présent"; else log_error "Fichier $f manquant"; fi
done
if [ -d "./certs" ]; then log_success "Répertoire certs présent"; else log_warn "Répertoire certs manquant"; fi
if ping -c 1 -W 2 192.168.0.154 >/dev/null 2>&1; then log_success "Connectivité vers 192.168.0.154 OK"; else log_error "Impossible de joindre 192.168.0.154"; fi
for port in 4000 4001 4002 4004 6379 3000; do
    if ! ss -tuln | grep -q ":$port "; then log_success "Port $port est disponible"; else log_warn "Port $port est déjà utilisé"; fi
done
if [ $ERRORS -eq 0 ]; then echo -e "${GREEN}Succès${NC}"; exit 0; else echo -e "${RED}$ERRORS erreurs${NC}"; exit 1; fi
