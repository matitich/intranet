# syntax=docker/dockerfile:1
FROM golang:1.24-bookworm AS build
WORKDIR /source
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export GIT_SSL_CAINFO=/run/secrets/proxy_ca SSL_CERT_FILE=/run/secrets/proxy_ca; fi; \
    git clone --depth 1 --branch RELEASE.2025-09-07T16-13-09Z https://github.com/minio/minio.git . && \
    test "$(git rev-parse HEAD)" = '07c3a429bfed433e49018cb0f78a52145d4bedeb' && \
    go mod download && go mod verify && \
    CGO_ENABLED=0 GOMAXPROCS=2 go build -p 2 -trimpath -o /minio . && \
    mkdir /data && chown 65532:65532 /data
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /minio /minio
COPY --from=build /source/LICENSE /LICENSE
COPY --from=build --chown=65532:65532 /data /data
USER 65532:65532
EXPOSE 9000 9001
ENTRYPOINT ["/minio"]
CMD ["server", "/data", "--console-address", ":9001"]
