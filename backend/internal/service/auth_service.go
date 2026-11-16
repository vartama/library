package service

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"vartama-library/internal/apperror"
	"vartama-library/internal/auth"
	"vartama-library/internal/model"
	"vartama-library/internal/repository"
)

type AuthService struct {
	users  *repository.UserRepository
	tokens *auth.TokenService
}

func NewAuthService(users *repository.UserRepository, tokens *auth.TokenService) *AuthService {
	return &AuthService{users: users, tokens: tokens}
}

type LoginResult struct {
	Token string             `json:"token"`
	User  model.UserResponse `json:"user"`
}

func (s *AuthService) Login(ctx context.Context, username, password string) (LoginResult, error) {
	user, err := s.users.FindByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return LoginResult{}, apperror.Unauthorized("Incorrect username or password.")
		}
		return LoginResult{}, err
	}

	if !auth.ComparePassword(password, user.PasswordHash) {
		return LoginResult{}, apperror.Unauthorized("Incorrect username or password.")
	}

	token, err := s.tokens.SignToken(user)
	if err != nil {
		return LoginResult{}, err
	}

	return LoginResult{
		Token: token,
		User:  user.ToResponse(),
	}, nil
}

func (s *AuthService) GetProfile(ctx context.Context, userID uuid.UUID) (model.UserResponse, error) {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.UserResponse{}, apperror.Unauthorized("Sign in to continue.")
		}
		return model.UserResponse{}, err
	}
	return user.ToResponse(), nil
}
