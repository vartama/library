package seed

import (
	"fmt"
	"math/rand/v2"
	"strings"
)

type BookSeed struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	Genre  string `json:"genre"`
	Stock  int    `json:"stock"`
}

var (
	adjectives = []string{
		"Silent", "Amber", "Distant", "Hidden", "Quiet", "Modern", "Practical", "Curious",
		"Golden", "Northern", "Broken", "Bright", "Restless", "Small", "Ancient", "Clear",
		"Wandering", "Winter", "Silver", "Steady", "Gentle", "Open", "First", "Last",
	}
	nouns = []string{
		"Harbour", "Compass", "Archive", "Garden", "Lantern", "Theorem", "Atlas", "Clockwork",
		"Bridge", "Journey", "Notebook", "Voyage", "Echo", "Pattern", "Chronicle", "Horizon",
		"Memory", "Forest", "Signal", "Studio", "Island", "Circuit", "Valley", "Observatory",
	}
	suffixes = []string{
		"of Tomorrow", "in Motion", "at Dusk", "Across Time", "for Beginners", "Revisited",
		"of the North", "on Paper", "in Practice", "from Afar", "of Glass", "Under Stars",
	}
	firstNames = []string{
		"Amina", "Lucas", "Hana", "Mateo", "Priya", "Jonas", "Sora", "Elena",
		"Tariq", "Clara", "Noah", "Maya", "Victor", "Nadia", "Kofi", "Ingrid",
	}
	lastNames = []string{
		"Lindqvist", "Bello", "Tanaka", "Morales", "Kaur", "Solberg", "Alvarez", "Mensah",
		"Sato", "Petrov", "Okafor", "Niemi", "Haddad", "Ferreira", "Cho", "Novak",
	}
)

// GenerateBooks deterministically expands curated books up to totalCount.
func GenerateBooks(curated []BookSeed, genres []string, totalCount int) []BookSeed {
	if totalCount <= 0 {
		return nil
	}
	if totalCount <= len(curated) {
		out := make([]BookSeed, totalCount)
		copy(out, curated[:totalCount])
		return out
	}

	out := make([]BookSeed, 0, totalCount)
	seenTitles := make(map[string]struct{}, totalCount)
	for _, b := range curated {
		out = append(out, b)
		seenTitles[strings.ToLower(b.Title)] = struct{}{}
	}

	rng := rand.New(rand.NewPCG(20261116, 42))
	needed := totalCount - len(curated)
	seq := 1

	for len(out) < totalCount {
		adj := adjectives[rng.IntN(len(adjectives))]
		noun := nouns[rng.IntN(len(nouns))]
		suf := suffixes[rng.IntN(len(suffixes))]
		title := fmt.Sprintf("%s %s %s", adj, noun, suf)
		if _, exists := seenTitles[strings.ToLower(title)]; exists {
			title = fmt.Sprintf("%s %s %s #%d", adj, noun, suf, seq)
			seq++
		}
		seenTitles[strings.ToLower(title)] = struct{}{}

		author := fmt.Sprintf("%s %s", firstNames[rng.IntN(len(firstNames))], lastNames[rng.IntN(len(lastNames))])
		genre := genres[(len(out)-len(curated))%len(genres)]

		// ~8% out of stock (0), ~13% low stock (1-2), rest 3-14.
		roll := rng.IntN(100)
		var stock int
		switch {
		case roll < 8:
			stock = 0
		case roll < 21:
			stock = 1 + rng.IntN(2)
		default:
			stock = 3 + rng.IntN(12)
		}

		out = append(out, BookSeed{
			Title:  title,
			Author: author,
			Genre:  genre,
			Stock:  stock,
		})
		_ = needed
	}

	return out
}
