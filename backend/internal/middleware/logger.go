package middleware

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

func SlogLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		if reqID := middleware.GetReqID(r.Context()); reqID != "" {
			ww.Header().Set("X-Request-Id", reqID)
		}
		start := time.Now()
		next.ServeHTTP(ww, r)
		slog.Info("http request",
			"reqId", middleware.GetReqID(r.Context()),
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"durationMs", time.Since(start).Milliseconds(),
		)
	})
}
