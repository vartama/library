package service

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"vartama-library/internal/apperror"
	"vartama-library/internal/cache"
	"vartama-library/internal/model"
	"vartama-library/internal/repository"
)

type BookService struct {
	books  *repository.BookRepository
	genres *repository.GenreRepository
	cache  *cache.CatalogCache
}

func NewBookService(books *repository.BookRepository, genres *repository.GenreRepository, cache *cache.CatalogCache) *BookService {
	return &BookService{books: books, genres: genres, cache: cache}
}

type ListBooksParams struct {
	Search  string
	GenreID *uuid.UUID
	SortBy  string
	Order   string
	Page    int
	Limit   int
}

func (s *BookService) ListBooks(ctx context.Context, p ListBooksParams) (model.BookPage, error) {
	cacheParams := map[string]string{
		"search": p.Search,
		"sortBy": p.SortBy,
		"order":  p.Order,
		"page":   strconv.Itoa(p.Page),
		"limit":  strconv.Itoa(p.Limit),
	}
	if p.GenreID != nil {
		cacheParams["genreId"] = p.GenreID.String()
	} else {
		cacheParams["genreId"] = ""
	}

	var out model.BookPage
	err := s.cache.Remember(ctx, "books", cacheParams, func(ctx context.Context) (any, error) {
		books, total, err := s.books.FindPage(
			ctx,
			repository.BookFilter{Search: p.Search, GenreID: p.GenreID},
			repository.BookSort{SortBy: p.SortBy, Order: p.Order},
			p.Page,
			p.Limit,
		)
		if err != nil {
			return nil, err
		}

		items := make([]model.BookResponse, 0, len(books))
		for i := range books {
			items = append(items, books[i].ToResponse())
		}

		totalPages := 0
		if total > 0 {
			totalPages = int(math.Ceil(float64(total) / float64(p.Limit)))
		}

		return model.BookPage{
			Items:      items,
			Page:       p.Page,
			Limit:      p.Limit,
			Total:      total,
			TotalPages: totalPages,
		}, nil
	}, &out)
	if err != nil {
		return model.BookPage{}, err
	}
	if out.Items == nil {
		out.Items = make([]model.BookResponse, 0)
	}
	return out, nil
}

func (s *BookService) GetOverview(ctx context.Context) (model.BookOverview, error) {
	var ov model.BookOverview
	err := s.cache.Remember(ctx, "overview", nil, func(ctx context.Context) (any, error) {
		return s.books.GetOverview(ctx)
	}, &ov)
	return ov, err
}

type CreateBookInput struct {
	Title   string
	Author  string
	GenreID uuid.UUID
	Stock   int
}

func (s *BookService) CreateBook(ctx context.Context, input CreateBookInput) (model.BookResponse, error) {
	if _, err := s.genres.FindByID(ctx, input.GenreID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.BookResponse{}, apperror.BadRequest("Validation failed.", apperror.FieldError{
				Field:   "genreId",
				Message: "Choose a genre.",
			})
		}
		return model.BookResponse{}, err
	}

	created, err := s.books.Create(ctx, &model.Book{
		Title:   strings.TrimSpace(input.Title),
		Author:  strings.TrimSpace(input.Author),
		GenreID: input.GenreID,
		Stock:   input.Stock,
	})
	if err != nil {
		if repository.IsUniqueViolation(err) {
			msg := "A book with this title already exists."
			return model.BookResponse{}, apperror.Conflict(msg, []apperror.FieldError{{Field: "title", Message: msg}})
		}
		return model.BookResponse{}, err
	}

	s.cache.Invalidate(ctx)
	return created.ToResponse(), nil
}

type UpdateBookInput struct {
	Title   *string
	Author  *string
	GenreID *uuid.UUID
	Stock   *int
}

func (s *BookService) UpdateBook(ctx context.Context, id uuid.UUID, input UpdateBookInput) (model.BookResponse, error) {
	if input.GenreID != nil {
		if _, err := s.genres.FindByID(ctx, *input.GenreID); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return model.BookResponse{}, apperror.BadRequest("Validation failed.", apperror.FieldError{
					Field:   "genreId",
					Message: "Choose a genre.",
				})
			}
			return model.BookResponse{}, err
		}
	}

	updated, err := s.books.Update(ctx, id, input.Title, input.Author, input.GenreID, input.Stock)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.BookResponse{}, apperror.NotFound("Book not found.")
		}
		if repository.IsUniqueViolation(err) {
			msg := "A book with this title already exists."
			return model.BookResponse{}, apperror.Conflict(msg, []apperror.FieldError{{Field: "title", Message: msg}})
		}
		return model.BookResponse{}, err
	}

	s.cache.Invalidate(ctx)
	return updated.ToResponse(), nil
}

func (s *BookService) DeleteBook(ctx context.Context, id uuid.UUID) error {
	if err := s.books.DeleteByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return apperror.NotFound("Book not found.")
		}
		return err
	}
	s.cache.Invalidate(ctx)
	return nil
}
