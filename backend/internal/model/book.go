package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Book struct {
	bun.BaseModel `bun:"table:books,alias:b"`

	ID        uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Title     string    `bun:"title,notnull"`
	Author    string    `bun:"author,notnull"`
	GenreID   uuid.UUID `bun:"genre_id,type:uuid,notnull"`
	Stock     int       `bun:"stock,notnull"`
	CreatedAt time.Time `bun:"created_at,notnull,default:current_timestamp"`
	UpdatedAt time.Time `bun:"updated_at,notnull,default:current_timestamp"`

	Genre *Genre `bun:"rel:belongs-to,join:genre_id=id"`
}

type BookResponse struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Author    string    `json:"author"`
	Genre     GenreRef  `json:"genre"`
	Stock     int       `json:"stock"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (b *Book) ToResponse() BookResponse {
	genre := GenreRef{ID: b.GenreID}
	if b.Genre != nil {
		genre.ID = b.Genre.ID
		genre.Name = b.Genre.Name
	}
	return BookResponse{
		ID:        b.ID,
		Title:     b.Title,
		Author:    b.Author,
		Genre:     genre,
		Stock:     b.Stock,
		CreatedAt: b.CreatedAt,
		UpdatedAt: b.UpdatedAt,
	}
}

type BookPage struct {
	Items      []BookResponse `json:"items"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	Total      int            `json:"total"`
	TotalPages int            `json:"totalPages"`
}

type BookOverview struct {
	TotalBooks  int `bun:"total_books" json:"totalBooks"`
	TotalCopies int `bun:"total_copies" json:"totalCopies"`
}
