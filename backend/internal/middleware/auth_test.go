package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"vartama-library/internal/auth"
	"vartama-library/internal/model"
)

func TestAuthenticateAndAuthorize(t *testing.T) {
	tokens := auth.NewTokenService("test-secret", time.Hour)
	expiredTokens := auth.NewTokenService("test-secret", -time.Minute)

	staff := &model.User{ID: uuid.New(), Username: "staff", Name: "Library Staff", Role: "user"}
	admin := &model.User{ID: uuid.New(), Username: "admin", Name: "Head Librarian", Role: "admin"}

	staffTok, err := tokens.SignToken(staff)
	require.NoError(t, err)
	adminTok, err := tokens.SignToken(admin)
	require.NoError(t, err)
	expiredTok, err := expiredTokens.SignToken(staff)
	require.NoError(t, err)

	protected := Authenticate(tokens)(Authorize("admin")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		require.True(t, ok)
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"role": u.Role})
	})))

	t.Run("missing header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		protected.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("invalid token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer broken.token.value")
		rec := httptest.NewRecorder()
		protected.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("expired token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+expiredTok)
		rec := httptest.NewRecorder()
		protected.ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("user role on admin route returns 403", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+staffTok)
		rec := httptest.NewRecorder()
		protected.ServeHTTP(rec, req)
		require.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("admin role succeeds", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+adminTok)
		rec := httptest.NewRecorder()
		protected.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code)
	})
}
