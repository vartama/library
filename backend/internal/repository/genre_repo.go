package repository

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"vartama-library/internal/model"
)

type GenreRepository struct {
	db *bun.DB
}

func NewGenreRepository(db *bun.DB) *GenreRepository {
	return &GenreRepository{db: db}
}

func (r *GenreRepository) FindAllWithBookCount(ctx context.Context) ([]model.GenreWithCount, error) {
	genres := make([]model.GenreWithCount, 0)
	err := r.db.NewSelect().
		TableExpr("genres AS g").
		ColumnExpr("g.id, g.name, COUNT(b.id)::int AS book_count").
		Join("LEFT JOIN books AS b ON b.genre_id = g.id").
		GroupExpr("g.id, g.name").
		OrderExpr("LOWER(g.name) ASC").
		Scan(ctx, &genres)
	if err != nil {
		return nil, err
	}
	return genres, nil
}

func (r *GenreRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Genre, error) {
	genre := new(model.Genre)
	err := r.db.NewSelect().
		Model(genre).
		Where("id = ?", id).
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return genre, nil
}

func (r *GenreRepository) Create(ctx context.Context, name string) (*model.Genre, error) {
	genre := &model.Genre{
		Name: strings.TrimSpace(name),
	}
	_, err := r.db.NewInsert().
		Model(genre).
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return genre, nil
}

func (r *GenreRepository) UpdateName(ctx context.Context, id uuid.UUID, name string) (*model.Genre, error) {
	genre := new(model.Genre)
	res, err := r.db.NewUpdate().
		Model(genre).
		Set("name = ?", strings.TrimSpace(name)).
		Set("updated_at = NOW()").
		Where("id = ?", id).
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, sql.ErrNoRows
	}
	return genre, nil
}

func (r *GenreRepository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.NewDelete().
		Model((*model.Genre)(nil)).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
