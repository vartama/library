FROM golang:1.26-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/seed ./cmd/seed

FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -u 10001 appuser
COPY --from=build /bin/api /bin/api
COPY --from=build /bin/seed /bin/seed
USER appuser
EXPOSE 3000
CMD ["/bin/api"]
