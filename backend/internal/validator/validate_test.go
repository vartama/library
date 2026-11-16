package validator

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestIsValidPhone(t *testing.T) {
	require.True(t, IsValidPhone("0812 3456 7890"))
	require.True(t, IsValidPhone("+62 (812) 3456-7890"))
	require.True(t, IsValidPhone("123456789"))
	require.False(t, IsValidPhone("12345"))
	require.False(t, IsValidPhone("0812abc7890"))
	require.False(t, IsValidPhone(""))
}

func TestParseFutureDueDate(t *testing.T) {
	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	_, ok := ParseFutureDueDate(today)
	require.False(t, ok)

	_, ok = ParseFutureDueDate(yesterday)
	require.False(t, ok)

	_, ok = ParseFutureDueDate("not-a-date")
	require.False(t, ok)

	parsed, ok := ParseFutureDueDate(tomorrow)
	require.True(t, ok)
	require.Equal(t, tomorrow, parsed.Format("2006-01-02"))
}
