package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Genre struct {
	bun.BaseModel `bun:"table:genres,alias:g"`

	ID        uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name      string    `bun:"name,notnull" json:"name"`
	CreatedAt time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type GenreRef struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type GenreWithCount struct {
	ID        uuid.UUID `bun:"id" json:"id"`
	Name      string    `bun:"name" json:"name"`
	BookCount int       `bun:"book_count" json:"bookCount"`
}
