package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"vartama-library/internal/auth"
	"vartama-library/internal/cache"
	"vartama-library/internal/config"
	"vartama-library/internal/database"
	"vartama-library/internal/database/migrations"
	"vartama-library/internal/handler"
	"vartama-library/internal/repository"
	"vartama-library/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "err", err)
		os.Exit(1)
	}
	if err := cfg.ValidateAPI(); err != nil {
		slog.Error("invalid configuration", "err", err)
		os.Exit(1)
	}

	logLevel := slog.LevelInfo
	if cfg.AppEnv == "development" {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel})))

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
		slog.Warn("invalid REDIS_URL, continuing without Redis cache", "err", err)
	}
	defer func() { _ = redisClient.Close() }()

	var cacheStore cache.Store
	if redisClient != nil {
		cacheStore = redisClient
	}
	catalogCache := cache.NewCatalogCache(cacheStore, cfg.CacheTTL)

	tokenSvc := auth.NewTokenService(cfg.JWTSecret, cfg.JWTExpiresIn)

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	bookRepo := repository.NewBookRepository(db)
	lendingRepo := repository.NewLendingRepository(db)

	authSvc := service.NewAuthService(userRepo, tokenSvc)
	genreSvc := service.NewGenreService(genreRepo, bookRepo, catalogCache)
	bookSvc := service.NewBookService(bookRepo, genreRepo, catalogCache)
	lendingSvc := service.NewLendingService(db, bookRepo, lendingRepo, catalogCache)

	router := handler.NewRouter(handler.RouterDeps{
		CORSOrigin: cfg.CORSOrigin,
		Tokens:     tokenSvc,
		Health:     handler.NewHealthHandler(catalogCache),
		Auth:       handler.NewAuthHandler(authSvc),
		Genres:     handler.NewGenreHandler(genreSvc),
		Books:      handler.NewBookHandler(bookSvc),
		Lendings:   handler.NewLendingHandler(lendingSvc),
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("server listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	slog.Info("shutting down server")
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
	}
}
