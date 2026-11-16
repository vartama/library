package repository

import (
	"context"

	"github.com/uptrace/bun"

	"vartama-library/internal/model"
)

type LendingRepository struct {
	db *bun.DB
}

func NewLendingRepository(db *bun.DB) *LendingRepository {
	return &LendingRepository{db: db}
}

func (r *LendingRepository) CreateWithItemsTx(ctx context.Context, tx bun.Tx, lending *model.Lending, items []*model.LendingItem) error {
	if _, err := tx.NewInsert().Model(lending).Returning("*").Exec(ctx); err != nil {
		return err
	}
	for _, it := range items {
		it.LendingID = lending.ID
	}
	if _, err := tx.NewInsert().Model(&items).Returning("*").Exec(ctx); err != nil {
		return err
	}
	lending.Items = items
	return nil
}

func (r *LendingRepository) FindAll(ctx context.Context) ([]model.Lending, error) {
	lendings := make([]model.Lending, 0)
	err := r.db.NewSelect().
		Model(&lendings).
		Relation("Items", func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.OrderExpr("li.title ASC")
		}).
		OrderExpr("l.created_at DESC").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return lendings, nil
}
