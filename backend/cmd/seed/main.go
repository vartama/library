package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	_ "time/tzdata"

	"vartama-library/internal/cache"
	"vartama-library/internal/config"
	"vartama-library/internal/database"
	"vartama-library/internal/database/migrations"
	"vartama-library/internal/seed"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "err", err)
		os.Exit(1)
	}
	if err := cfg.ValidateSeed(); err != nil {
		slog.Error("invalid configuration", "err", err)
		os.Exit(1)
	}

	booksFlag := flag.Int("books", cfg.SeedBookCount, "total number of books to seed")
	flag.Parse()

	ctx := context.Background()
	db, err := database.NewDB(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to PostgreSQL", "err", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close() }()

	if err := migrations.Run(ctx, db); err != nil {
		slog.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}

	redisClient, err := cache.NewRedis(cfg.RedisURL)
	if err != nil {
		slog.Warn("invalid REDIS_URL, continuing without Redis invalidation", "err", err)
	}
	defer func() { _ = redisClient.Close() }()

	var cacheStore cache.Store
	if redisClient != nil {
		cacheStore = redisClient
	}
	catalogCache := cache.NewCatalogCache(cacheStore, cfg.CacheTTL)

	res, err := seed.Run(ctx, db, catalogCache, seed.Options{
		AdminPassword: cfg.SeedAdminPassword,
		UserPassword:  cfg.SeedUserPassword,
		BookCount:     *booksFlag,
	})
	if err != nil {
		slog.Error("seed failed", "err", err)
		os.Exit(1)
	}

	slog.Info("seed completed", "users", res.Users, "genres", res.Genres, "books", res.Books)
}
