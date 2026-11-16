package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv            string
	Port              string
	DatabaseURL       string
	TestDatabaseURL   string
	CORSOrigin        string
	JWTSecret         string
	JWTExpiresIn      time.Duration
	SeedAdminPassword string
	SeedUserPassword  string
	SeedBookCount     int
	RedisURL          string
	CacheTTL          time.Duration
}

func Load() (Config, error) {
	// Ignore error if .env does not exist (e.g., Docker / CI passes env vars directly).
	_ = godotenv.Load()

	expiresIn, err := time.ParseDuration(getEnv("JWT_EXPIRES_IN", "8h"))
	if err != nil || expiresIn <= 0 {
		return Config{}, errors.New("JWT_EXPIRES_IN must be a valid positive duration (e.g. 8h)")
	}

	seedBookCount := 1000
	if raw := strings.TrimSpace(os.Getenv("SEED_BOOK_COUNT")); raw != "" {
		n, convErr := strconv.Atoi(raw)
		if convErr != nil || n < 0 {
			return Config{}, errors.New("SEED_BOOK_COUNT must be a non-negative integer")
		}
		seedBookCount = n
	}

	cacheTTLSeconds := 60
	if raw := strings.TrimSpace(os.Getenv("CACHE_TTL_SECONDS")); raw != "" {
		n, convErr := strconv.Atoi(raw)
		if convErr != nil || n <= 0 {
			return Config{}, errors.New("CACHE_TTL_SECONDS must be a positive integer")
		}
		cacheTTLSeconds = n
	}

	return Config{
		AppEnv:            getEnv("APP_ENV", "development"),
		Port:              getEnv("PORT", "3000"),
		DatabaseURL:       strings.TrimSpace(os.Getenv("DATABASE_URL")),
		TestDatabaseURL:   strings.TrimSpace(os.Getenv("TEST_DATABASE_URL")),
		CORSOrigin:        getEnv("CORS_ORIGIN", "http://localhost:5173"),
		JWTSecret:         strings.TrimSpace(os.Getenv("JWT_SECRET")),
		JWTExpiresIn:      expiresIn,
		SeedAdminPassword: getEnv("SEED_ADMIN_PASSWORD", "admin123"),
		SeedUserPassword:  getEnv("SEED_USER_PASSWORD", "user123"),
		SeedBookCount:     seedBookCount,
		RedisURL:          strings.TrimSpace(os.Getenv("REDIS_URL")),
		CacheTTL:          time.Duration(cacheTTLSeconds) * time.Second,
	}, nil
}

func (c Config) ValidateAPI() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if c.JWTSecret == "" {
		return errors.New("JWT_SECRET is required")
	}
	return nil
}

func (c Config) ValidateSeed() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
