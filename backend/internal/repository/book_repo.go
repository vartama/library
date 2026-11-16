package repository

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"vartama-library/internal/model"
)

type BookFilter struct {
	Search  string
	GenreID *uuid.UUID
}

type BookSort struct {
	SortBy string // "title" | "stock"
	Order  string // "asc" | "desc"
}

type BookRepository struct {
	db *bun.DB
}

func NewBookRepository(db *bun.DB) *BookRepository {
	return &BookRepository{db: db}
}

var likeEscaper = strings.NewReplacer(
	`\`, `\\`,
	`%`, `\%`,
	`_`, `\_`,
)

func (r *BookRepository) FindPage(ctx context.Context, filter BookFilter, sort BookSort, page, limit int) ([]model.Book, int, error) {
	books := make([]model.Book, 0)
	q := r.db.NewSelect().
		Model(&books).
		Relation("Genre")

	if filter.GenreID != nil {
		q = q.Where("b.genre_id = ?", *filter.GenreID)
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		pattern := "%" + likeEscaper.Replace(s) + "%"
		q = q.Where("(b.title ILIKE ? ESCAPE '\\' OR b.author ILIKE ? ESCAPE '\\')", pattern, pattern)
	}

	q = q.OrderExpr(bookOrderExpr(sort))

	offset := (page - 1) * limit
	total, err := q.Limit(int64(limit)).Offset(int64(offset)).ScanAndCount(ctx)
	if err != nil {
		return nil, 0, err
	}
	return books, int(total), nil
}

func bookOrderExpr(sort BookSort) string {
	switch sort.SortBy {
	case "stock":
		if sort.Order == "desc" {
			return "b.stock DESC, LOWER(b.title) ASC, b.id ASC"
		}
		return "b.stock ASC, LOWER(b.title) ASC, b.id ASC"
	default:
		if sort.Order == "desc" {
			return "LOWER(b.title) DESC, b.id ASC"
		}
		return "LOWER(b.title) ASC, b.id ASC"
	}
}

func (r *BookRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Book, error) {
	book := new(model.Book)
	err := r.db.NewSelect().
		Model(book).
		Relation("Genre").
		Where("b.id = ?", id).
		Limit(1).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return book, nil
}

func (r *BookRepository) FindByIDsForUpdateTx(ctx context.Context, tx bun.Tx, ids []uuid.UUID) ([]model.Book, error) {
	books := make([]model.Book, 0, len(ids))
	err := tx.NewSelect().
		Model(&books).
		Where("b.id IN (?)", bun.In(ids)).
		OrderExpr("b.id ASC").
		For("UPDATE").
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return books, nil
}

func (r *BookRepository) GetOverview(ctx context.Context) (model.BookOverview, error) {
	var ov model.BookOverview
	err := r.db.NewSelect().
		TableExpr("books").
		ColumnExpr("COUNT(*)::int AS total_books, COALESCE(SUM(stock), 0)::int AS total_copies").
		Scan(ctx, &ov)
	return ov, err
}

func (r *BookRepository) CountByGenre(ctx context.Context, genreID uuid.UUID) (int, error) {
	n, err := r.db.NewSelect().
		Model((*model.Book)(nil)).
		Where("genre_id = ?", genreID).
		Count(ctx)
	return int(n), err
}

func (r *BookRepository) Create(ctx context.Context, book *model.Book) (*model.Book, error) {
	_, err := r.db.NewInsert().
		Model(book).
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, book.ID)
}

func (r *BookRepository) Update(ctx context.Context, id uuid.UUID, title *string, author *string, genreID *uuid.UUID, stock *int) (*model.Book, error) {
	q := r.db.NewUpdate().
		Model((*model.Book)(nil)).
		Set("updated_at = NOW()").
		Where("id = ?", id)

	if title != nil {
		q = q.Set("title = ?", strings.TrimSpace(*title))
	}
	if author != nil {
		q = q.Set("author = ?", strings.TrimSpace(*author))
	}
	if genreID != nil {
		q = q.Set("genre_id = ?", *genreID)
	}
	if stock != nil {
		q = q.Set("stock = ?", *stock)
	}

	res, err := q.Exec(ctx)
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
	return r.FindByID(ctx, id)
}

func (r *BookRepository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.NewDelete().
		Model((*model.Book)(nil)).
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

func (r *BookRepository) DecrementStockTx(ctx context.Context, tx bun.Tx, id uuid.UUID, qty int) (bool, error) {
	res, err := tx.NewUpdate().
		Model((*model.Book)(nil)).
		Set("stock = stock - ?", qty).
		Set("updated_at = NOW()").
		Where("id = ? AND stock >= ?", id, qty).
		Exec(ctx)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}
