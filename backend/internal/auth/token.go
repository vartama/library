package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"vartama-library/internal/model"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
)

type Claims struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type AuthUser struct {
	ID       uuid.UUID
	Username string
	Name     string
	Role     string
}

type TokenService struct {
	secret    []byte
	expiresIn time.Duration
}

func NewTokenService(secret string, expiresIn time.Duration) *TokenService {
	return &TokenService{
		secret:    []byte(secret),
		expiresIn: expiresIn,
	}
}

func (s *TokenService) SignToken(user *model.User) (string, error) {
	now := time.Now()
	claims := Claims{
		Username: user.Username,
		Name:     user.Name,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.expiresIn)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *TokenService) VerifyToken(tokenStr string) (AuthUser, error) {
	parsed, err := jwt.ParseWithClaims(
		tokenStr,
		&Claims{},
		func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, ErrInvalidToken
			}
			return s.secret, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil {
		return AuthUser{}, ErrInvalidToken
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return AuthUser{}, ErrInvalidToken
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return AuthUser{}, ErrInvalidToken
	}

	return AuthUser{
		ID:       userID,
		Username: claims.Username,
		Name:     claims.Name,
		Role:     claims.Role,
	}, nil
}
