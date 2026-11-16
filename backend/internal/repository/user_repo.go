package repository

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"vartama-library/internal/model"
)

type UserRepository struct {
	db *bun.DB
}

func NewUserRepository(db *bun.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	user := new(model.User)
	err := r.db.NewSelect().
		Model(user).
		Where("LOWER(username) = LOWER(?)", strings.TrimSpace(username)).
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	user := new(model.User)
	err := r.db.NewSelect().
		Model(user).
		Where("id = ?", id).
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) Upsert(ctx context.Context, user *model.User) error {
	user.Username = strings.ToLower(strings.TrimSpace(user.Username))
	user.Name = strings.TrimSpace(user.Name)

	_, err := r.db.NewInsert().
		Model(user).
		On("CONFLICT (LOWER(username)) DO UPDATE").
		Set("name = EXCLUDED.name").
		Set("password_hash = EXCLUDED.password_hash").
		Set("role = EXCLUDED.role").
		Set("updated_at = NOW()").
		Returning("*").
		Exec(ctx)
	return err
}
