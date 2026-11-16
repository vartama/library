package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"
)

type Store interface {
	Status(ctx context.Context) string
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
	Incr(ctx context.Context, key string) (int64, error)
}

type CatalogCache struct {
	store Store
	ttl   time.Duration
}

func NewCatalogCache(store Store, ttl time.Duration) *CatalogCache {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	return &CatalogCache{
		store: store,
		ttl:   ttl,
	}
}

func (c *CatalogCache) HealthStatus(ctx context.Context) string {
	if c == nil || c.store == nil {
		return "off"
	}
	return c.store.Status(ctx)
}

func (c *CatalogCache) Invalidate(ctx context.Context) {
	if c == nil || c.store == nil {
		return
	}
	_, _ = c.store.Incr(ctx, versionKey)
}

func (c *CatalogCache) Remember(ctx context.Context, name string, params map[string]string, loader func(context.Context) (any, error), dst any) error {
	if c == nil || c.store == nil {
		val, err := loader(ctx)
		if err != nil {
			return err
		}
		return assignJSON(val, dst)
	}

	version, err := c.store.Get(ctx, versionKey)
	if err != nil || version == "" {
		// Key not initialized or Redis unreachable: fail-open if Redis errored on anything other than missing key.
		if err == nil || isKeyNotFound(err) {
			version = "1"
			_ = c.store.Set(ctx, versionKey, version, 0)
		} else {
			val, lErr := loader(ctx)
			if lErr != nil {
				return lErr
			}
			return assignJSON(val, dst)
		}
	}

	key := buildKey(version, name, params)
	if cached, gErr := c.store.Get(ctx, key); gErr == nil {
		if uErr := json.Unmarshal([]byte(cached), dst); uErr == nil {
			slog.Debug("cache hit", "key", key)
			return nil
		}
	}

	val, err := loader(ctx)
	if err != nil {
		return err
	}

	if encoded, mErr := json.Marshal(val); mErr == nil {
		_ = c.store.Set(ctx, key, string(encoded), c.ttl)
	}

	return assignJSON(val, dst)
}

func buildKey(version, name string, params map[string]string) string {
	if len(params) == 0 {
		return fmt.Sprintf("vartama:catalog:v%s:%s", version, name)
	}
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", k, params[k]))
	}
	return fmt.Sprintf("vartama:catalog:v%s:%s:%s", version, name, strings.Join(parts, "&"))
}

func assignJSON(src any, dst any) error {
	raw, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, dst)
}

func isKeyNotFound(err error) bool {
	return err != nil && err.Error() == "redis: nil"
}
