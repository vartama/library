package auth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPasswordHashAndCompare(t *testing.T) {
	hash, err := HashPassword("secret123")
	require.NoError(t, err)
	require.NotEmpty(t, hash)
	require.NotEqual(t, "secret123", hash)

	require.True(t, ComparePassword("secret123", hash))
	require.False(t, ComparePassword("wrong", hash))
}
