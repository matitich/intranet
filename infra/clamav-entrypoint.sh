#!/bin/sh
set -eu
# FreshClam no interpreta automáticamente HTTPS_PROXY. Solo se aceptan proxies
# HTTP sin credenciales locales; la autenticación sigue a cargo de la plataforma.
proxy_url="${HTTPS_PROXY:-${https_proxy:-}}"
if [ -n "$proxy_url" ]; then
  case "$proxy_url" in
    http://*) authority="${proxy_url#http://}" ;;
    *) echo 'Tipo de proxy no soportado para FreshClam.' >&2; exit 1 ;;
  esac
  authority="${authority%/}"
  case "$authority" in *@*|*/*) echo 'Proxy con formato no soportado.' >&2; exit 1 ;; esac
  proxy_host="${authority%:*}"
  proxy_port="${authority##*:}"
  if [ "$proxy_host" = "$proxy_port" ]; then proxy_port=80; fi
  sed -i '/^HTTPProxyServer /d; /^HTTPProxyPort /d' /etc/clamav/freshclam.conf
  printf '\nHTTPProxyServer %s\nHTTPProxyPort %s\n' "$proxy_host" "$proxy_port" >> /etc/clamav/freshclam.conf
fi
exec /init "$@"
