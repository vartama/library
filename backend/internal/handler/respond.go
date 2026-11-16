package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"vartama-library/internal/apperror"
)

type envelope struct {
	Data any `json:"data"`
}

type errorBody struct {
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Data: data})
}

func writeNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func writeErrorPayload(w http.ResponseWriter, status int, message string, details any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorBody{
		Message: message,
		Details: details,
	})
}

func handleError(w http.ResponseWriter, err error) {
	var appErr *apperror.AppError
	if errors.As(err, &appErr) {
		writeErrorPayload(w, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		writeErrorPayload(w, http.StatusNotFound, "Resource not found.", nil)
		return
	}

	slog.Error("unhandled server error", "err", err)
	writeErrorPayload(w, http.StatusInternalServerError, "Internal server error.", nil)
}
