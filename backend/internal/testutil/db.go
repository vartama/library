package testutil

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"

	"vartama-library/internal/database"
	"vartama-library/internal/database/migrations"
)

func SetupTestDB(t *testing.T) *bun.DB {
	t.Helper()
	_ = godotenv.Load("../../.env")

	dsn := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping PostgreSQL integration test")
	}

	ctx := context.Background()
	db, err := database.NewDB(ctx, dsn)
	if err != nil {
		t.Skipf("skipping PostgreSQL integration test (cannot connect): %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	require.NoError(t, migrations.Run(ctx, db))
	TruncateAll(t, db)
	return db
}

func TruncateAll(t *testing.T, db *bun.DB) {
	t.Helper()
	_, err := db.ExecContext(context.Background(), "TRUNCATE TABLE lending_items, lendings, books, genres, users RESTART IDENTITY CASCADE")
	require.NoError(t, err)
}
