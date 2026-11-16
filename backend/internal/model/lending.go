package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Lending struct {
	bun.BaseModel `bun:"table:lendings,alias:l"`

	ID           uuid.UUID      `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	BorrowerName string         `bun:"borrower_name,notnull"`
	PhoneNumber  string         `bun:"phone_number,notnull"`
	DueDate      time.Time      `bun:"due_date,type:date,notnull"`
	LentByID     *uuid.UUID     `bun:"lent_by_id,type:uuid"`
	LentByName   string         `bun:"lent_by_name,notnull"`
	CreatedAt    time.Time      `bun:"created_at,notnull,default:current_timestamp"`
	Items        []*LendingItem `bun:"rel:has-many,join:id=lending_id"`
}

type LendingItem struct {
	bun.BaseModel `bun:"table:lending_items,alias:li"`

	ID        uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	LendingID uuid.UUID  `bun:"lending_id,type:uuid,notnull"`
	BookID    *uuid.UUID `bun:"book_id,type:uuid"`
	Title     string     `bun:"title,notnull"`
	Quantity  int        `bun:"quantity,notnull"`
}

type LendingItemResponse struct {
	BookID   uuid.UUID `json:"bookId"`
	Title    string    `json:"title"`
	Quantity int       `json:"quantity"`
}

type LentByResponse struct {
	ID   *uuid.UUID `json:"id"`
	Name string     `json:"name"`
}

type LendingResponse struct {
	ID           uuid.UUID             `json:"id"`
	BorrowerName string                `json:"borrowerName"`
	PhoneNumber  string                `json:"phoneNumber"`
	DueDate      string                `json:"dueDate"`
	Items        []LendingItemResponse `json:"items"`
	LentBy       LentByResponse        `json:"lentBy"`
	CreatedAt    time.Time             `json:"createdAt"`
}

func (l *Lending) ToResponse() LendingResponse {
	items := make([]LendingItemResponse, 0, len(l.Items))
	for _, it := range l.Items {
		bookID := it.ID
		if it.BookID != nil {
			bookID = *it.BookID
		}
		items = append(items, LendingItemResponse{
			BookID:   bookID,
			Title:    it.Title,
			Quantity: it.Quantity,
		})
	}
	return LendingResponse{
		ID:           l.ID,
		BorrowerName: l.BorrowerName,
		PhoneNumber:  l.PhoneNumber,
		DueDate:      l.DueDate.Format("2006-01-02"),
		Items:        items,
		LentBy: LentByResponse{
			ID:   l.LentByID,
			Name: l.LentByName,
		},
		CreatedAt: l.CreatedAt,
	}
}
