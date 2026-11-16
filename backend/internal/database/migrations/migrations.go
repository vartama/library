package migrations

import (
	"context"
	"embed"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"
)

//go:embed *.sql
var sqlMigrations embed.FS

func NewMigrator(db *bun.DB) (*migrate.Migrator, error) {
	migrations := migrate.NewMigrations()
	if err := migrations.Discover(sqlMigrations); err != nil {
		return nil, err
	}
	return migrate.NewMigrator(db, migrations), nil
}

func Run(ctx context.Context, db *bun.DB) error {
	migrator, err := NewMigrator(db)
	if err != nil {
		return err
	}
	if err := migrator.Init(ctx); err != nil {
		return err
	}
	_, err = migrator.Migrate(ctx)
	return err
}
