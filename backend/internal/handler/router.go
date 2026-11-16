package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"vartama-library/internal/auth"
	"vartama-library/internal/constants"
	"vartama-library/internal/middleware"
)

type RouterDeps struct {
	CORSOrigin       string
	Tokens           *auth.TokenService
	Health           *HealthHandler
	Auth             *AuthHandler
	Genres           *GenreHandler
	Books            *BookHandler
	Lendings         *LendingHandler
	DisableRateLimit bool
}

func NewRouter(deps RouterDeps) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.SlogLogger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{deps.CORSOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		writeErrorPayload(w, http.StatusNotFound, "Route not found.", nil)
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeErrorPayload(w, http.StatusMethodNotAllowed, "Method not allowed.", nil)
	})

	r.Route("/api", func(api chi.Router) {
		api.Get("/health", deps.Health.Check)

		api.Route("/auth", func(ar chi.Router) {
			if deps.DisableRateLimit {
				ar.Post("/login", deps.Auth.Login)
			} else {
				limiter := httprate.Limit(
					10,
					15*time.Minute,
					httprate.WithKeyFuncs(httprate.KeyByIP),
					httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
						writeErrorPayload(w, http.StatusTooManyRequests, "Too many login attempts. Please try again later.", nil)
					}),
				)
				ar.With(limiter).Post("/login", deps.Auth.Login)
			}
			ar.With(middleware.Authenticate(deps.Tokens)).Get("/me", deps.Auth.Me)
		})

		api.Group(func(protected chi.Router) {
			protected.Use(middleware.Authenticate(deps.Tokens))

			protected.Route("/genres", func(gr chi.Router) {
				gr.Get("/", deps.Genres.List)
				gr.With(middleware.Authorize(constants.RoleAdmin)).Post("/", deps.Genres.Create)
				gr.With(middleware.Authorize(constants.RoleAdmin)).Patch("/{id}", deps.Genres.Update)
				gr.With(middleware.Authorize(constants.RoleAdmin)).Delete("/{id}", deps.Genres.Delete)
			})

			protected.Route("/books", func(br chi.Router) {
				br.Get("/", deps.Books.List)
				br.Get("/overview", deps.Books.Overview)
				br.With(middleware.Authorize(constants.RoleAdmin)).Post("/", deps.Books.Create)
				br.With(middleware.Authorize(constants.RoleAdmin)).Patch("/{id}", deps.Books.Update)
				br.With(middleware.Authorize(constants.RoleAdmin)).Delete("/{id}", deps.Books.Delete)
			})

			protected.Route("/lendings", func(lr chi.Router) {
				lr.Get("/", deps.Lendings.List)
				lr.Post("/", deps.Lendings.Create)
			})
		})
	})

	return r
}
