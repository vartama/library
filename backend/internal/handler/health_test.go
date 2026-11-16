package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"vartama-library/internal/auth"
	"vartama-library/internal/cache"
)

func TestHealthAndNotFoundRoutes(t *testing.T) {
	r := NewRouter(RouterDeps{
		CORSOrigin: "http://localhost:5173",
		Tokens:     auth.NewTokenService("test-secret", time.Hour),
		Health:     NewHealthHandler(cache.NewCatalogCache(nil, time.Minute)),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Data struct {
			Status string `json:"status"`
			Cache  string `json:"cache"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, "ok", body.Data.Status)
	require.Equal(t, "off", body.Data.Cache)

	req404 := httptest.NewRequest(http.MethodGet, "/api/unknown", nil)
	rec404 := httptest.NewRecorder()
	r.ServeHTTP(rec404, req404)
	require.Equal(t, http.StatusNotFound, rec404.Code)

	var errBody struct {
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(rec404.Body.Bytes(), &errBody))
	require.Equal(t, "Route not found.", errBody.Message)
}
