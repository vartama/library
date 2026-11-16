package validator

import (
	"encoding/json"
	"io"
	"net/http"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"

	"vartama-library/internal/apperror"
)

var validate *validator.Validate
var phoneDigitsRegex = regexp.MustCompile(`^\d{9,15}$`)
var phoneStripReplacer = strings.NewReplacer(" ", "", "+", "", "-", "", "(", "", ")", "")

func init() {
	validate = validator.New(validator.WithRequiredStructEnabled())
	validate.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" || name == "" {
			return fld.Name
		}
		return name
	})
}

func DecodeJSON(r *http.Request, dst any) error {
	if r.Body == nil {
		return apperror.BadRequest("Request body is required.")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := dec.Decode(dst); err != nil {
		return apperror.BadRequest("Invalid request body.")
	}
	return nil
}

func Struct(s any) []apperror.FieldError {
	err := validate.Struct(s)
	if err == nil {
		return nil
	}
	valErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return []apperror.FieldError{{Field: "", Message: err.Error()}}
	}
	details := make([]apperror.FieldError, 0, len(valErrs))
	for _, fe := range valErrs {
		details = append(details, apperror.FieldError{
			Field:   fe.Field(),
			Message: messageForTag(fe),
		})
	}
	return details
}

func DecodeAndValidate(r *http.Request, dst any) error {
	if err := DecodeJSON(r, dst); err != nil {
		return err
	}
	if details := Struct(dst); len(details) > 0 {
		return apperror.BadRequest("Validation failed.", details...)
	}
	return nil
}

func IsValidPhone(raw string) bool {
	stripped := phoneStripReplacer.Replace(strings.TrimSpace(raw))
	return phoneDigitsRegex.MatchString(stripped)
}

func ParseFutureDueDate(raw string) (time.Time, bool) {
	trimmed := strings.TrimSpace(raw)
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return time.Time{}, false
	}
	today := time.Now().Format("2006-01-02")
	if trimmed <= today {
		return time.Time{}, false
	}
	return parsed, true
}

func messageForTag(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return fe.Field() + " is required."
	case "min":
		return fe.Field() + " must be at least " + fe.Param() + "."
	case "max":
		return fe.Field() + " must be at most " + fe.Param() + "."
	case "gte":
		return fe.Field() + " must be " + fe.Param() + " or more."
	case "oneof":
		return fe.Field() + " must be one of: " + fe.Param() + "."
	case "uuid":
		return fe.Field() + " must be a valid ID."
	default:
		return fe.Field() + " is invalid."
	}
}
