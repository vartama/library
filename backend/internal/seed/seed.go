package seed

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"vartama-library/internal/auth"
	"vartama-library/internal/cache"
	"vartama-library/internal/constants"
	"vartama-library/internal/model"
	"vartama-library/internal/repository"
)

//go:embed data/*.json
var seedFS embed.FS

type Options struct {
	AdminPassword string
	UserPassword  string
	BookCount     int
}

type Result struct {
	Users  int
	Genres int
	Books  int
}

func LoadDefaults() ([]string, []BookSeed, error) {
	genresRaw, err := seedFS.ReadFile("data/genres.json")
	if err != nil {
		return nil, nil, err
	}
	var genres []string
	if err := json.Unmarshal(genresRaw, &genres); err != nil {
		return nil, nil, err
	}

	booksRaw, err := seedFS.ReadFile("data/books.json")
	if err != nil {
		return nil, nil, err
	}
	var books []BookSeed
	if err := json.Unmarshal(booksRaw, &books); err != nil {
		return nil, nil, err
	}
	return genres, books, nil
}

func Run(ctx context.Context, db *bun.DB, catalogCache *cache.CatalogCache, opts Options) (Result, error) {
	genreNames, curatedBooks, err := LoadDefaults()
	if err != nil {
		return Result{}, err
	}

	adminHash, err := auth.HashPassword(opts.AdminPassword)
	if err != nil {
		return Result{}, err
	}
	staffHash, err := auth.HashPassword(opts.UserPassword)
	if err != nil {
		return Result{}, err
	}

	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Upsert(ctx, &model.User{
		Username:     "admin",
		Name:         "Head Librarian",
		PasswordHash: adminHash,
		Role:         constants.RoleAdmin,
	}); err != nil {
		return Result{}, fmt.Errorf("upsert admin user: %w", err)
	}
	if err := userRepo.Upsert(ctx, &model.User{
		Username:     "staff",
		Name:         "Library Staff",
		PasswordHash: staffHash,
		Role:         constants.RoleUser,
	}); err != nil {
		return Result{}, fmt.Errorf("upsert staff user: %w", err)
	}

	booksToInsert := GenerateBooks(curatedBooks, genreNames, opts.BookCount)

	err = db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// Clear transactional tables cleanly so seed can run repeatedly.
		if _, err := tx.NewDelete().Model((*model.LendingItem)(nil)).Where("TRUE").Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Model((*model.Lending)(nil)).Where("TRUE").Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Model((*model.Book)(nil)).Where("TRUE").Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Model((*model.Genre)(nil)).Where("TRUE").Exec(ctx); err != nil {
			return err
		}

		genreModels := make([]*model.Genre, 0, len(genreNames))
		for _, name := range genreNames {
			genreModels = append(genreModels, &model.Genre{Name: name})
		}
		if _, err := tx.NewInsert().Model(&genreModels).Returning("*").Exec(ctx); err != nil {
			return err
		}

		genreByName := make(map[string]uuid.UUID, len(genreModels))
		for _, g := range genreModels {
			genreByName[g.Name] = g.ID
		}

		if len(booksToInsert) == 0 {
			return nil
		}

		bookModels := make([]*model.Book, 0, len(booksToInsert))
		for _, b := range booksToInsert {
			gid, ok := genreByName[b.Genre]
			if !ok {
				return fmt.Errorf("unknown genre %q in seed data", b.Genre)
			}
			bookModels = append(bookModels, &model.Book{
				Title:   b.Title,
				Author:  b.Author,
				GenreID: gid,
				Stock:   b.Stock,
			})
		}

		const chunkSize = 500
		for start := 0; start < len(bookModels); start += chunkSize {
			end := start + chunkSize
			if end > len(bookModels) {
				end = len(bookModels)
			}
			chunk := bookModels[start:end]
			if _, err := tx.NewInsert().Model(&chunk).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return Result{}, err
	}

	catalogCache.Invalidate(ctx)

	return Result{
		Users:  2,
		Genres: len(genreNames),
		Books:  len(booksToInsert),
	}, nil
}
