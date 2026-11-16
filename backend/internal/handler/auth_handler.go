package handler

import (
	"net/http"
	"strings"

	"vartama-library/internal/apperror"
	"vartama-library/internal/middleware"
	"vartama-library/internal/service"
	"vartama-library/internal/validator"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := validator.DecodeJSON(r, &req); err != nil {
		handleError(w, err)
		return
	}

	var details []apperror.FieldError
	if strings.TrimSpace(req.Username) == "" {
		details = append(details, apperror.FieldError{Field: "username", Message: "Enter your username."})
	}
	if req.Password == "" {
		details = append(details, apperror.FieldError{Field: "password", Message: "Enter your password."})
	}
	if len(details) > 0 {
		handleError(w, apperror.BadRequest("Validation failed.", details...))
		return
	}

	res, err := h.auth.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		handleError(w, apperror.Unauthorized("Sign in to continue."))
		return
	}
	profile, err := h.auth.GetProfile(r.Context(), user.ID)
	if err != nil {
		handleError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}
