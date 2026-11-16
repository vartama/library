package cache

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type fakeStore struct {
	data   map[string]string
	down   bool
	status string
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		data:   make(map[string]string),
		status: "up",
	}
}

func (f *fakeStore) Status(context.Context) string {
	if f.down {
		return "down"
	}
	return f.status
}

func (f *fakeStore) Get(_ context.Context, key string) (string, error) {
	if f.down {
		return "", errors.New("connection refused")
	}
	v, ok := f.data[key]
	if !ok {
		return "", errors.New("redis: nil")
	}
	return v, nil
}

func (f *fakeStore) Set(_ context.Context, key, value string, _ time.Duration) error {
	if f.down {
		return errors.New("connection refused")
	}
	f.data[key] = value
	return nil
}

func (f *fakeStore) Incr(_ context.Context, key string) (int64, error) {
	if f.down {
		return 0, errors.New("connection refused")
	}
	cur, _ := strconv.ParseInt(f.data[key], 10, 64)
	cur++
	f.data[key] = strconv.FormatInt(cur, 10)
	return cur, nil
}

func TestCatalogCacheRememberInvalidateFailOpen(t *testing.T) {
	ctx := context.Background()

	offCache := NewCatalogCache(nil, time.Minute)
	require.Equal(t, "off", offCache.HealthStatus(ctx))

	store := newFakeStore()
	c := NewCatalogCache(store, time.Minute)
	require.Equal(t, "up", c.HealthStatus(ctx))

	loads := 0
	loader := func(context.Context) (any, error) {
		loads++
		return map[string]int{"count": loads}, nil
	}

	var out map[string]int
	require.NoError(t, c.Remember(ctx, "books", map[string]string{"page": "1"}, loader, &out))
	require.Equal(t, 1, loads)
	require.Equal(t, 1, out["count"])

	// Cache hit should not call loader again.
	out = nil
	require.NoError(t, c.Remember(ctx, "books", map[string]string{"page": "1"}, loader, &out))
	require.Equal(t, 1, loads)
	require.Equal(t, 1, out["count"])

	// Version bump invalidates cached reads.
	c.Invalidate(ctx)
	out = nil
	require.NoError(t, c.Remember(ctx, "books", map[string]string{"page": "1"}, loader, &out))
	require.Equal(t, 2, loads)
	require.Equal(t, 2, out["count"])

	// Fail-open when Redis is down.
	store.down = true
	require.Equal(t, "down", c.HealthStatus(ctx))
	out = nil
	require.NoError(t, c.Remember(ctx, "books", map[string]string{"page": "1"}, loader, &out))
	require.Equal(t, 3, loads)
	require.Equal(t, 3, out["count"])
}
