package apperror

import (
	"fmt"
	"net/http"
)

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type AppError struct {
	StatusCode int
	Message    string
	Details    any
	Err        error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func New(statusCode int, message string, details any) *AppError {
	return &AppError{
		StatusCode: statusCode,
		Message:    message,
		Details:    details,
	}
}

func BadRequest(message string, details ...FieldError) *AppError {
	var d any
	if len(details) > 0 {
		d = details
	}
	return &AppError{StatusCode: http.StatusBadRequest, Message: message, Details: d}
}

func Unauthorized(message string) *AppError {
	return &AppError{StatusCode: http.StatusUnauthorized, Message: message}
}

func Forbidden(message string) *AppError {
	return &AppError{StatusCode: http.StatusForbidden, Message: message}
}

func NotFound(message string, details ...any) *AppError {
	var d any
	if len(details) > 0 {
		d = details[0]
	}
	return &AppError{StatusCode: http.StatusNotFound, Message: message, Details: d}
}

func Conflict(message string, details any) *AppError {
	return &AppError{StatusCode: http.StatusConflict, Message: message, Details: details}
}
