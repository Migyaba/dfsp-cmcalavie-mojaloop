#!/bin/bash
start() { docker compose up -d; }
stop() { docker compose down; }
restart() { docker compose restart; }
status() { docker compose ps; }
logs() { docker compose logs "$@"; }
health() {
    echo "Checks:"
    docker compose exec redis redis-cli ping | grep -q PONG && echo "Redis: OK" || echo "Redis: FAIL"
    for s in backend sdk-scheme-adapter; do
        st=$(docker inspect --format='{{.State.Health.Status}}' $(docker compose ps -q $s) 2>/dev/null || echo "not running")
        echo "$s: $st"
    done
}
test_connectivity() {
    ping -c 1 192.168.0.154 >/dev/null && echo "HUB: OK" || echo "HUB: FAIL"
    nslookup google.com >/dev/null 2>&1 && echo "DNS: OK" || echo "DNS: FAIL"
}
case "$1" in
    start) start ;; stop) stop ;; restart) restart ;; status) status ;; logs) shift; logs "$@" ;; health) health ;; test) test_connectivity ;;
    *) echo "Usage: $0 {start|stop|restart|status|logs|health|test}"; exit 1 ;;
esac
