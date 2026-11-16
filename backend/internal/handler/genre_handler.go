package handler

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"vartama-library/internal/apperror"
	"vartama-library/internal/service"
	"vartama-library/internal/validator"
)

type GenreHandler struct {
	genres *service.GenreService
}

func NewGenreHandler(genres *service.GenreService) *GenreHandler {
	return &GenreHandler{genres: genres}
}

type genreRequest struct {
	Name string `json:"name"`
}

func (h *GenreHandler) List(w http.ResponseWriter, r *http.Request) {
	genres, err := h.genres.ListGenres(r.Context())
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, genres)
}

func (h *GenreHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req genreRequest
	if err := validator.DecodeJSON(r, &req); err != nil {
		handleError(w, err)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
			Field:   "name",
			Message: "Enter the genre name.",
		}))
		return
	}

	created, err := h.genres.CreateGenre(r.Context(), name)
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *GenreHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, apperror.BadRequest("Invalid genre ID."))
		return
	}

	var req genreRequest
	if err := validator.DecodeJSON(r, &req); err != nil {
		handleError(w, err)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
			Field:   "name",
			Message: "Enter the genre name.",
		}))
		return
	}

	updated, err := h.genres.UpdateGenre(r.Context(), id, name)
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *GenreHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, apperror.BadRequest("Invalid genre ID."))
		return
	}

	if err := h.genres.DeleteGenre(r.Context(), id); err != nil {
		handleError(w, err)
		return
	}
	writeNoContent(w)
}
