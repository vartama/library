package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"vartama-library/internal/model"
)

func TestTokenSignAndVerify(t *testing.T) {
	svc := NewTokenService("super-secret-key", time.Hour)
	user := &model.User{
		ID:       uuid.New(),
		Username: "admin",
		Name:     "Head Librarian",
		Role:     "admin",
	}

	tok, err := svc.SignToken(user)
	require.NoError(t, err)
	require.NotEmpty(t, tok)

	got, err := svc.VerifyToken(tok)
	require.NoError(t, err)
	require.Equal(t, user.ID, got.ID)
	require.Equal(t, "admin", got.Username)
	require.Equal(t, "Head Librarian", got.Name)
	require.Equal(t, "admin", got.Role)

	wrongSecret := NewTokenService("other-secret", time.Hour)
	_, err = wrongSecret.VerifyToken(tok)
	require.Error(t, err)

	expiredSvc := NewTokenService("super-secret-key", -time.Minute)
	expiredTok, err := expiredSvc.SignToken(user)
	require.NoError(t, err)
	_, err = svc.VerifyToken(expiredTok)
	require.Error(t, err)
}
