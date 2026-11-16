package handler

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"vartama-library/internal/apperror"
	"vartama-library/internal/service"
	"vartama-library/internal/validator"
)

type BookHandler struct {
	books *service.BookService
}

func NewBookHandler(books *service.BookService) *BookHandler {
	return &BookHandler{books: books}
}

type createBookRequest struct {
	Title   string `json:"title"`
	Author  string `json:"author"`
	GenreID string `json:"genreId"`
	Stock   *int   `json:"stock"`
}

type updateBookRequest struct {
	Title   *string `json:"title"`
	Author  *string `json:"author"`
	GenreID *string `json:"genreId"`
	Stock   *int    `json:"stock"`
}

func (h *BookHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	search := strings.TrimSpace(q.Get("search"))
	if utf8.RuneCountInString(search) > 100 {
		handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
			Field:   "search",
			Message: "Search query must be 100 characters or less.",
		}))
		return
	}

	var genreID *uuid.UUID
	if rawGenreID := strings.TrimSpace(q.Get("genreId")); rawGenreID != "" {
		parsed, err := uuid.Parse(rawGenreID)
		if err != nil {
			handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
				Field:   "genreId",
				Message: "Invalid genre ID.",
			}))
			return
		}
		genreID = &parsed
	}

	sortBy := q.Get("sortBy")
	if sortBy == "" {
		sortBy = "title"
	}
	if sortBy != "title" && sortBy != "stock" {
		handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
			Field:   "sortBy",
			Message: "sortBy must be title or stock.",
		}))
		return
	}

	order := q.Get("order")
	if order == "" {
		order = "asc"
	}
	if order != "asc" && order != "desc" {
		handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
			Field:   "order",
			Message: "order must be asc or desc.",
		}))
		return
	}

	page := 1
	if rawPage := strings.TrimSpace(q.Get("page")); rawPage != "" {
		n, err := strconv.Atoi(rawPage)
		if err != nil || n < 1 {
			handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
				Field:   "page",
				Message: "page must be 1 or more.",
			}))
			return
		}
		page = n
	}

	limit := 20
	if rawLimit := strings.TrimSpace(q.Get("limit")); rawLimit != "" {
		n, err := strconv.Atoi(rawLimit)
		if err != nil || n < 1 || n > 100 {
			handleError(w, apperror.BadRequest("Validation failed.", apperror.FieldError{
				Field:   "limit",
				Message: "limit must be between 1 and 100.",
			}))
			return
		}
		limit = n
	}

	res, err := h.books.ListBooks(r.Context(), service.ListBooksParams{
		Search:  search,
		GenreID: genreID,
		SortBy:  sortBy,
		Order:   order,
		Page:    page,
		Limit:   limit,
	})
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *BookHandler) Overview(w http.ResponseWriter, r *http.Request) {
	ov, err := h.books.GetOverview(r.Context())
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ov)
}

func (h *BookHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createBookRequest
	if err := validator.DecodeJSON(r, &req); err != nil {
		handleError(w, err)
		return
	}

	var details []apperror.FieldError
	title := strings.TrimSpace(req.Title)
	author := strings.TrimSpace(req.Author)
	if title == "" {
		details = append(details, apperror.FieldError{Field: "title", Message: "Enter the book title."})
	}
	if author == "" {
		details = append(details, apperror.FieldError{Field: "author", Message: "Enter the author."})
	}
	genreID, gErr := uuid.Parse(strings.TrimSpace(req.GenreID))
	if gErr != nil {
		details = append(details, apperror.FieldError{Field: "genreId", Message: "Choose a genre."})
	}
	if req.Stock == nil || *req.Stock < 1 {
		details = append(details, apperror.FieldError{Field: "stock", Message: "Enter a whole number, 1 or more."})
	}
	if len(details) > 0 {
		handleError(w, apperror.BadRequest("Validation failed.", details...))
		return
	}

	created, err := h.books.CreateBook(r.Context(), service.CreateBookInput{
		Title:   title,
		Author:  author,
		GenreID: genreID,
		Stock:   *req.Stock,
	})
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *BookHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, apperror.BadRequest("Invalid book ID."))
		return
	}

	var req updateBookRequest
	if err := validator.DecodeJSON(r, &req); err != nil {
		handleError(w, err)
		return
	}
	if req.Title == nil && req.Author == nil && req.GenreID == nil && req.Stock == nil {
		handleError(w, apperror.BadRequest("Provide at least one field to update."))
		return
	}

	var details []apperror.FieldError
	var input service.UpdateBookInput

	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			details = append(details, apperror.FieldError{Field: "title", Message: "Enter the book title."})
		} else {
			input.Title = &t
		}
	}
	if req.Author != nil {
		a := strings.TrimSpace(*req.Author)
		if a == "" {
			details = append(details, apperror.FieldError{Field: "author", Message: "Enter the author."})
		} else {
			input.Author = &a
		}
	}
	if req.GenreID != nil {
		gID, gErr := uuid.Parse(strings.TrimSpace(*req.GenreID))
		if gErr != nil {
			details = append(details, apperror.FieldError{Field: "genreId", Message: "Choose a genre."})
		} else {
			input.GenreID = &gID
		}
	}
	if req.Stock != nil {
		if *req.Stock < 0 {
			details = append(details, apperror.FieldError{Field: "stock", Message: "Enter a whole number, 0 or more."})
		} else {
			input.Stock = req.Stock
		}
	}
	if len(details) > 0 {
		handleError(w, apperror.BadRequest("Validation failed.", details...))
		return
	}

	updated, err := h.books.UpdateBook(r.Context(), id, input)
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *BookHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, apperror.BadRequest("Invalid book ID."))
		return
	}

	if err := h.books.DeleteBook(r.Context(), id); err != nil {
		handleError(w, err)
		return
	}
	writeNoContent(w)
}
