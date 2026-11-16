package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel `bun:"table:users,alias:u"`

	ID           uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Username     string    `bun:"username,notnull" json:"username"`
	Name         string    `bun:"name,notnull" json:"name"`
	PasswordHash string    `bun:"password_hash,notnull" json:"-"`
	Role         string    `bun:"role,notnull" json:"role"`
	CreatedAt    time.Time `bun:"created_at,notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt    time.Time `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}

type UserResponse struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Name     string    `json:"name"`
	Role     string    `json:"role"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:       u.ID,
		Username: u.Username,
		Name:     u.Name,
		Role:     u.Role,
	}
}
