package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"vartama-library/internal/auth"
	"vartama-library/internal/cache"
	"vartama-library/internal/repository"
	"vartama-library/internal/seed"
	"vartama-library/internal/service"
	"vartama-library/internal/testutil"
)

type testApp struct {
	router http.Handler
	admin  string
	staff  string
}

func setupIntegrationApp(t *testing.T, disableRateLimit bool) testApp {
	t.Helper()
	db := testutil.SetupTestDB(t)
	ctx := context.Background()
	catalogCache := cache.NewCatalogCache(nil, time.Minute)

	_, err := seed.Run(ctx, db, catalogCache, seed.Options{
		AdminPassword: "admin123",
		UserPassword:  "user123",
		BookCount:     7,
	})
	require.NoError(t, err)

	tokens := auth.NewTokenService("integration-secret", time.Hour)
	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	bookRepo := repository.NewBookRepository(db)
	lendingRepo := repository.NewLendingRepository(db)

	router := NewRouter(RouterDeps{
		CORSOrigin:       "http://localhost:5173",
		Tokens:           tokens,
		Health:           NewHealthHandler(catalogCache),
		Auth:             NewAuthHandler(service.NewAuthService(userRepo, tokens)),
		Genres:           NewGenreHandler(service.NewGenreService(genreRepo, bookRepo, catalogCache)),
		Books:            NewBookHandler(service.NewBookService(bookRepo, genreRepo, catalogCache)),
		Lendings:         NewLendingHandler(service.NewLendingService(db, bookRepo, lendingRepo, catalogCache)),
		DisableRateLimit: disableRateLimit,
	})

	adminToken := loginToken(t, router, "admin", "admin123")
	staffToken := loginToken(t, router, "staff", "user123")

	return testApp{
		router: router,
		admin:  adminToken,
		staff:  staffToken,
	}
}

func doJSON(t *testing.T, r http.Handler, method, path, token string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	if payload != nil {
		require.NoError(t, json.NewEncoder(&body).Encode(payload))
	}
	req := httptest.NewRequest(method, path, &body)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func loginToken(t *testing.T, r http.Handler, username, password string) string {
	t.Helper()
	rec := doJSON(t, r, http.MethodPost, "/api/auth/login", "", map[string]string{
		"username": username,
		"password": password,
	})
	require.Equal(t, http.StatusOK, rec.Code)
	var out struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.NotEmpty(t, out.Data.Token)
	return out.Data.Token
}

func TestIntegrationAuthAndRBAC(t *testing.T) {
	app := setupIntegrationApp(t, true)

	// Identical 401 message for unknown username and wrong password.
	r1 := doJSON(t, app.router, http.MethodPost, "/api/auth/login", "", map[string]string{"username": "nobody", "password": "x"})
	r2 := doJSON(t, app.router, http.MethodPost, "/api/auth/login", "", map[string]string{"username": "admin", "password": "wrong"})
	require.Equal(t, http.StatusUnauthorized, r1.Code)
	require.Equal(t, http.StatusUnauthorized, r2.Code)
	require.JSONEq(t, r1.Body.String(), r2.Body.String())

	// Me endpoint omits passwordHash.
	me := doJSON(t, app.router, http.MethodGet, "/api/auth/me", app.admin, nil)
	require.Equal(t, http.StatusOK, me.Code)
	require.NotContains(t, me.Body.String(), "passwordHash")

	// Unauthenticated and role checks.
	require.Equal(t, http.StatusUnauthorized, doJSON(t, app.router, http.MethodGet, "/api/books", "", nil).Code)
	require.Equal(t, http.StatusForbidden, doJSON(t, app.router, http.MethodPost, "/api/genres", app.staff, map[string]string{"name": "Poetry"}).Code)
}

func TestIntegrationGenresBooksLendingAndHistory(t *testing.T) {
	app := setupIntegrationApp(t, true)

	// List genres with counts.
	gRec := doJSON(t, app.router, http.MethodGet, "/api/genres", app.admin, nil)
	require.Equal(t, http.StatusOK, gRec.Code)
	var genresOut struct {
		Data []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			BookCount int    `json:"bookCount"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(gRec.Body.Bytes(), &genresOut))
	require.Len(t, genresOut.Data, 6)

	var fictionID string
	for _, g := range genresOut.Data {
		if g.Name == "Fiction" {
			fictionID = g.ID
			require.Equal(t, 2, g.BookCount)
		}
	}
	require.NotEmpty(t, fictionID)

	// Cannot delete genre in use.
	delInUse := doJSON(t, app.router, http.MethodDelete, "/api/genres/"+fictionID, app.admin, nil)
	require.Equal(t, http.StatusConflict, delInUse.Code)

	// Create, duplicate check, and delete empty genre.
	newGenre := doJSON(t, app.router, http.MethodPost, "/api/genres", app.admin, map[string]string{"name": "Poetry"})
	require.Equal(t, http.StatusCreated, newGenre.Code)
	dupGenre := doJSON(t, app.router, http.MethodPost, "/api/genres", app.admin, map[string]string{"name": "poetry"})
	require.Equal(t, http.StatusConflict, dupGenre.Code)

	var createdGenre struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(newGenre.Body.Bytes(), &createdGenre))
	require.Equal(t, http.StatusNoContent, doJSON(t, app.router, http.MethodDelete, "/api/genres/"+createdGenre.Data.ID, app.admin, nil).Code)

	// Create book, duplicate title check, PATCH stock to 0, list with filter/search/pagination.
	bRec := doJSON(t, app.router, http.MethodPost, "/api/books", app.admin, map[string]any{
		"title":   "100% Wild _Test",
		"author":  "Ada Lovelace",
		"genreId": fictionID,
		"stock":   2,
	})
	require.Equal(t, http.StatusCreated, bRec.Code)
	var createdBook struct {
		Data struct {
			ID    string `json:"id"`
			Title string `json:"title"`
			Stock int    `json:"stock"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(bRec.Body.Bytes(), &createdBook))

	dupBook := doJSON(t, app.router, http.MethodPost, "/api/books", app.admin, map[string]any{
		"title":   "100% wild _test",
		"author":  "Ada Lovelace",
		"genreId": fictionID,
		"stock":   1,
	})
	require.Equal(t, http.StatusConflict, dupBook.Code)

	// Search literal '%' matches only the book with '%' in title.
	searchRec := doJSON(t, app.router, http.MethodGet, "/api/books?search=100%25", app.staff, nil)
	require.Equal(t, http.StatusOK, searchRec.Code)
	var pageOut struct {
		Data struct {
			Items []struct {
				ID    string `json:"id"`
				Title string `json:"title"`
				Stock int    `json:"stock"`
			} `json:"items"`
			Total int `json:"total"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(searchRec.Body.Bytes(), &pageOut))
	require.Equal(t, 1, pageOut.Data.Total)
	require.Equal(t, "100% Wild _Test", pageOut.Data.Items[0].Title)

	// Concurrent lending for last copies: 2 goroutines each requesting qty=2 when stock=2.
	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := range 2 {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			res := doJSON(t, app.router, http.MethodPost, "/api/lendings", app.staff, map[string]any{
				"borrowerName": "Budi Santoso",
				"phoneNumber":  "0812 3456 7890",
				"dueDate":      tomorrow,
				"items": []map[string]any{
					{"bookId": createdBook.Data.ID, "quantity": 2},
				},
			})
			codes[idx] = res.Code
		}(i)
	}
	wg.Wait()
	require.ElementsMatch(t, []int{http.StatusCreated, http.StatusConflict}, codes)

	// Delete the lent book and verify lending history preserves title snapshot.
	require.Equal(t, http.StatusNoContent, doJSON(t, app.router, http.MethodDelete, "/api/books/"+createdBook.Data.ID, app.admin, nil).Code)

	histRec := doJSON(t, app.router, http.MethodGet, "/api/lendings", app.staff, nil)
	require.Equal(t, http.StatusOK, histRec.Code)
	var histOut struct {
		Data []struct {
			DueDate string `json:"dueDate"`
			LentBy  struct {
				Name string `json:"name"`
			} `json:"lentBy"`
			Items []struct {
				BookID   string `json:"bookId"`
				Title    string `json:"title"`
				Quantity int    `json:"quantity"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(histRec.Body.Bytes(), &histOut))
	require.Len(t, histOut.Data, 1)
	require.Equal(t, tomorrow, histOut.Data[0].DueDate)
	require.Equal(t, "Library Staff", histOut.Data[0].LentBy.Name)
	require.Equal(t, "100% Wild _Test", histOut.Data[0].Items[0].Title)
	require.NotEmpty(t, histOut.Data[0].Items[0].BookID)
}
