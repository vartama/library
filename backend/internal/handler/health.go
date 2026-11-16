package handler

import (
	"net/http"

	"vartama-library/internal/cache"
)

type HealthHandler struct {
	cache *cache.CatalogCache
}

func NewHealthHandler(cache *cache.CatalogCache) *HealthHandler {
	return &HealthHandler{cache: cache}
}

func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"cache":  h.cache.HealthStatus(r.Context()),
	})
}
