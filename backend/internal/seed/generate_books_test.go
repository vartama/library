package seed

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGenerateBooksDeterministicAndUnique(t *testing.T) {
	genres, curated, err := LoadDefaults()
	require.NoError(t, err)
	require.Len(t, genres, 6)
	require.Len(t, curated, 7)

	first := GenerateBooks(curated, genres, 1000)
	second := GenerateBooks(curated, genres, 1000)
	require.Len(t, first, 1000)
	require.Equal(t, first, second)

	titles := make(map[string]struct{}, len(first))
	genreCounts := make(map[string]int, len(genres))
	zeroStock := 0
	lowStock := 0

	for _, b := range first {
		lower := strings.ToLower(b.Title)
		_, dup := titles[lower]
		require.False(t, dup, "duplicate title: %s", b.Title)
		titles[lower] = struct{}{}
		genreCounts[b.Genre]++
		require.GreaterOrEqual(t, b.Stock, 0)
		if b.Stock == 0 {
			zeroStock++
		} else if b.Stock <= 2 {
			lowStock++
		}
	}

	require.Greater(t, zeroStock, 30)
	require.Greater(t, lowStock, 50)
	for _, g := range genres {
		require.Greater(t, genreCounts[g], 150)
	}
}
