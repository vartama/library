package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"vartama-library/internal/auth"
)

type contextKey string

const userContextKey contextKey = "authUser"

func UserFromContext(ctx context.Context) (auth.AuthUser, bool) {
	u, ok := ctx.Value(userContextKey).(auth.AuthUser)
	return u, ok
}

func WithUser(ctx context.Context, user auth.AuthUser) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func Authenticate(tokens *auth.TokenService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := strings.TrimSpace(r.Header.Get("Authorization"))
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				writeAuthError(w, http.StatusUnauthorized, "Sign in to continue.")
				return
			}
			rawToken := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
			if rawToken == "" {
				writeAuthError(w, http.StatusUnauthorized, "Sign in to continue.")
				return
			}

			user, err := tokens.VerifyToken(rawToken)
			if err != nil {
				writeAuthError(w, http.StatusUnauthorized, "Your session has expired. Sign in again.")
				return
			}

			ctx := WithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func Authorize(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok {
				writeAuthError(w, http.StatusUnauthorized, "Sign in to continue.")
				return
			}
			if !slices.Contains(roles, user.Role) {
				writeAuthError(w, http.StatusForbidden, "You do not have permission to do this.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeAuthError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": message})
}
