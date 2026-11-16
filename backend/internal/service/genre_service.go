package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"vartama-library/internal/apperror"
	"vartama-library/internal/cache"
	"vartama-library/internal/model"
	"vartama-library/internal/repository"
)

type GenreService struct {
	genres *repository.GenreRepository
	books  *repository.BookRepository
	cache  *cache.CatalogCache
}

func NewGenreService(genres *repository.GenreRepository, books *repository.BookRepository, cache *cache.CatalogCache) *GenreService {
	return &GenreService{genres: genres, books: books, cache: cache}
}

func (s *GenreService) ListGenres(ctx context.Context) ([]model.GenreWithCount, error) {
	var result []model.GenreWithCount
	err := s.cache.Remember(ctx, "genres", nil, func(ctx context.Context) (any, error) {
		return s.genres.FindAllWithBookCount(ctx)
	}, &result)
	if err != nil {
		return nil, err
	}
	if result == nil {
		result = make([]model.GenreWithCount, 0)
	}
	return result, nil
}

func (s *GenreService) CreateGenre(ctx context.Context, name string) (*model.Genre, error) {
	created, err := s.genres.Create(ctx, name)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			msg := "A genre with this name already exists."
			return nil, apperror.Conflict(msg, []apperror.FieldError{{Field: "name", Message: msg}})
		}
		return nil, err
	}
	s.cache.Invalidate(ctx)
	return created, nil
}

func (s *GenreService) UpdateGenre(ctx context.Context, id uuid.UUID, name string) (*model.Genre, error) {
	updated, err := s.genres.UpdateName(ctx, id, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, apperror.NotFound("Genre not found.")
		}
		if repository.IsUniqueViolation(err) {
			msg := "A genre with this name already exists."
			return nil, apperror.Conflict(msg, []apperror.FieldError{{Field: "name", Message: msg}})
		}
		return nil, err
	}
	s.cache.Invalidate(ctx)
	return updated, nil
}

func (s *GenreService) DeleteGenre(ctx context.Context, id uuid.UUID) error {
	genre, err := s.genres.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return apperror.NotFound("Genre not found.")
		}
		return err
	}

	count, err := s.books.CountByGenre(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		noun := "books"
		if count == 1 {
			noun = "book"
		}
		return apperror.Conflict(
			fmt.Sprintf("â€œ%sâ€ still has %d %s. Move or remove them first.", genre.Name, count, noun),
			nil,
		)
	}

	if err := s.genres.DeleteByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return apperror.NotFound("Genre not found.")
		}
		if repository.IsForeignKeyViolation(err) {
			return apperror.Conflict(
				fmt.Sprintf("â€œ%sâ€ still has books. Move or remove them first.", genre.Name),
				nil,
			)
		}
		return err
	}
	s.cache.Invalidate(ctx)
	return nil
}
