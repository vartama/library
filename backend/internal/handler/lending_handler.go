package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"vartama-library/internal/apperror"
	"vartama-library/internal/middleware"
	"vartama-library/internal/service"
	"vartama-library/internal/validator"
)

type LendingHandler struct {
	lendings *service.LendingService
}

func NewLendingHandler(lendings *service.LendingService) *LendingHandler {
	return &LendingHandler{lendings: lendings}
}

type lendingItemRequest struct {
	BookID   string `json:"bookId"`
	Quantity *int   `json:"quantity"`
}

type createLendingRequest struct {
	BorrowerName string               `json:"borrowerName"`
	PhoneNumber  string               `json:"phoneNumber"`
	DueDate      string               `json:"dueDate"`
	Items        []lendingItemRequest `json:"items"`
}

func (h *LendingHandler) Create(w http.ResponseWriter, r *http.Request) {
	actor, ok := middleware.UserFromContext(r.Context())
	if !ok {
		handleError(w, apperror.Unauthorized("Sign in to continue."))
		return
	}

	var req createLendingRequest
	if err := validator.DecodeJSON(r, &req); err != nil {
		handleError(w, err)
		return
	}

	var details []apperror.FieldError
	borrowerName := strings.TrimSpace(req.BorrowerName)
	if borrowerName == "" {
		details = append(details, apperror.FieldError{Field: "borrowerName", Message: "Enter the borrower's name."})
	}
	if !validator.IsValidPhone(req.PhoneNumber) {
		details = append(details, apperror.FieldError{Field: "phoneNumber", Message: "Enter a phone number with 9â€“15 digits."})
	}
	dueDate, okDate := validator.ParseFutureDueDate(req.DueDate)
	if !okDate {
		msg := "Due date must be after today."
		if strings.TrimSpace(req.DueDate) == "" {
			msg = "Choose a due date."
		}
		details = append(details, apperror.FieldError{Field: "dueDate", Message: msg})
	}

	if len(req.Items) == 0 {
		details = append(details, apperror.FieldError{Field: "items", Message: "Add at least one book."})
	}

	items := make([]service.LendingItemInput, 0, len(req.Items))
	seen := make(map[uuid.UUID]struct{}, len(req.Items))
	for i, it := range req.Items {
		bookID, err := uuid.Parse(strings.TrimSpace(it.BookID))
		if err != nil {
			details = append(details, apperror.FieldError{
				Field:   fmt.Sprintf("items.%d.bookId", i),
				Message: "Choose a book.",
			})
		} else {
			if _, exists := seen[bookID]; exists {
				details = append(details, apperror.FieldError{
					Field:   fmt.Sprintf("items.%d.bookId", i),
					Message: "This book is already in the list.",
				})
			}
			seen[bookID] = struct{}{}
		}

		qty := 0
		if it.Quantity == nil || *it.Quantity < 1 {
			details = append(details, apperror.FieldError{
				Field:   fmt.Sprintf("items.%d.quantity", i),
				Message: "Enter a whole number, 1 or more.",
			})
		} else {
			qty = *it.Quantity
		}

		if err == nil && qty >= 1 {
			items = append(items, service.LendingItemInput{
				BookID:   bookID,
				Quantity: qty,
			})
		}
	}

	if len(details) > 0 {
		handleError(w, apperror.BadRequest("Validation failed.", details...))
		return
	}

	created, err := h.lendings.CreateLending(r.Context(), service.CreateLendingInput{
		BorrowerName: borrowerName,
		PhoneNumber:  req.PhoneNumber,
		DueDate:      dueDate,
		Items:        items,
	}, actor)
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *LendingHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.lendings.ListLendings(r.Context())
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}
