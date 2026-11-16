package service

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"vartama-library/internal/apperror"
	"vartama-library/internal/auth"
	"vartama-library/internal/cache"
	"vartama-library/internal/model"
	"vartama-library/internal/repository"
)

type LendingService struct {
	db       *bun.DB
	books    *repository.BookRepository
	lendings *repository.LendingRepository
	cache    *cache.CatalogCache
}

func NewLendingService(
	db *bun.DB,
	books *repository.BookRepository,
	lendings *repository.LendingRepository,
	cache *cache.CatalogCache,
) *LendingService {
	return &LendingService{
		db:       db,
		books:    books,
		lendings: lendings,
		cache:    cache,
	}
}

type LendingItemInput struct {
	BookID   uuid.UUID
	Quantity int
}

type CreateLendingInput struct {
	BorrowerName string
	PhoneNumber  string
	DueDate      time.Time
	Items        []LendingItemInput
}

type MissingBookDetail struct {
	BookID uuid.UUID `json:"bookId"`
}

type InsufficientStockDetail struct {
	BookID    uuid.UUID `json:"bookId"`
	Title     string    `json:"title"`
	Requested int       `json:"requested"`
	Available int       `json:"available"`
}

func (s *LendingService) CreateLending(ctx context.Context, input CreateLendingInput, actor auth.AuthUser) (model.LendingResponse, error) {
	ids := make([]uuid.UUID, 0, len(input.Items))
	for _, it := range input.Items {
		ids = append(ids, it.BookID)
	}
	// Deterministic lock order prevents deadlocks when concurrent transactions share books.
	slices.SortFunc(ids, func(a, b uuid.UUID) int {
		return strings.Compare(a.String(), b.String())
	})

	var created *model.Lending
	err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		lockedBooks, err := s.books.FindByIDsForUpdateTx(ctx, tx, ids)
		if err != nil {
			return err
		}

		bookMap := make(map[uuid.UUID]model.Book, len(lockedBooks))
		for _, b := range lockedBooks {
			bookMap[b.ID] = b
		}

		var missing []MissingBookDetail
		for _, it := range input.Items {
			if _, ok := bookMap[it.BookID]; !ok {
				missing = append(missing, MissingBookDetail{BookID: it.BookID})
			}
		}
		if len(missing) > 0 {
			return apperror.NotFound("Some of these books are no longer in the library.", missing)
		}

		var shortages []InsufficientStockDetail
		for _, it := range input.Items {
			b := bookMap[it.BookID]
			if it.Quantity > b.Stock {
				shortages = append(shortages, InsufficientStockDetail{
					BookID:    b.ID,
					Title:     b.Title,
					Requested: it.Quantity,
					Available: b.Stock,
				})
			}
		}
		if len(shortages) > 0 {
			return apperror.Conflict("Not enough copies available.", shortages)
		}

		lendingItems := make([]*model.LendingItem, 0, len(input.Items))
		for _, it := range input.Items {
			b := bookMap[it.BookID]
			ok, decErr := s.books.DecrementStockTx(ctx, tx, it.BookID, it.Quantity)
			if decErr != nil {
				return decErr
			}
			if !ok {
				return apperror.Conflict("Not enough copies available.", []InsufficientStockDetail{{
					BookID:    b.ID,
					Title:     b.Title,
					Requested: it.Quantity,
					Available: b.Stock,
				}})
			}
			bookID := b.ID
			lendingItems = append(lendingItems, &model.LendingItem{
				BookID:   &bookID,
				Title:    b.Title,
				Quantity: it.Quantity,
			})
		}

		actorID := actor.ID
		lending := &model.Lending{
			BorrowerName: strings.TrimSpace(input.BorrowerName),
			PhoneNumber:  strings.TrimSpace(input.PhoneNumber),
			DueDate:      input.DueDate,
			LentByID:     &actorID,
			LentByName:   actor.Name,
		}
		if err := s.lendings.CreateWithItemsTx(ctx, tx, lending, lendingItems); err != nil {
			return err
		}
		created = lending
		return nil
	})
	if err != nil {
		return model.LendingResponse{}, err
	}

	s.cache.Invalidate(ctx)
	return created.ToResponse(), nil
}

func (s *LendingService) ListLendings(ctx context.Context) ([]model.LendingResponse, error) {
	lendings, err := s.lendings.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]model.LendingResponse, 0, len(lendings))
	for i := range lendings {
		res = append(res, lendings[i].ToResponse())
	}
	return res, nil
}
