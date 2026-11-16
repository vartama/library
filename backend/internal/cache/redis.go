package cache

import (
	"context"
	"log/slog"
	"net"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

const versionKey = "vartama:catalog:version"

type RedisClient struct {
	client *redis.Client
	down   atomic.Bool
}

// NewRedis creates a non-blocking Redis client. Returns nil if redisURL is empty.
func NewRedis(redisURL string) (*RedisClient, error) {
	if redisURL == "" {
		return nil, nil
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	opts.DialTimeout = 2 * time.Second
	opts.ReadTimeout = 1 * time.Second
	opts.WriteTimeout = 1 * time.Second

	rc := &RedisClient{}
	opts.OnConnect = func(ctx context.Context, cn *redis.Conn) error {
		if rc.down.Swap(false) {
			slog.Info("redis connection restored, bumping catalog cache version")
			// Bump version so any stale entries written before disconnect are bypassed.
			_ = cn.Incr(ctx, versionKey).Err()
		}
		return nil
	}
	// Dialer fallback to detect initial outage only once.
	origDialer := opts.Dialer
	opts.Dialer = func(ctx context.Context, network, addr string) (net.Conn, error) {
		var (
			conn net.Conn
			dErr error
		)
		if origDialer != nil {
			conn, dErr = origDialer(ctx, network, addr)
		} else {
			d := net.Dialer{Timeout: opts.DialTimeout}
			conn, dErr = d.DialContext(ctx, network, addr)
		}
		if dErr != nil {
			rc.markDown(dErr)
		}
		return conn, dErr
	}

	rc.client = redis.NewClient(opts)
	return rc, nil
}

func (r *RedisClient) markDown(err error) {
	if r == nil {
		return
	}
	if !r.down.Swap(true) {
		slog.Warn("redis unavailable, falling back to PostgreSQL", "err", err)
	}
}

func (r *RedisClient) markUp() {
	if r == nil {
		return
	}
	if r.down.Swap(false) {
		slog.Info("redis connection restored")
	}
}

func (r *RedisClient) Status(ctx context.Context) string {
	if r == nil || r.client == nil {
		return "off"
	}
	pingCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	if err := r.client.Ping(pingCtx).Err(); err != nil {
		r.markDown(err)
		return "down"
	}
	r.markUp()
	return "up"
}

func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	val, err := r.client.Get(ctx, key).Result()
	if err != nil && err != redis.Nil {
		r.markDown(err)
	} else if err == nil {
		r.markUp()
	}
	return val, err
}

func (r *RedisClient) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	err := r.client.Set(ctx, key, value, ttl).Err()
	if err != nil {
		r.markDown(err)
	} else {
		r.markUp()
	}
	return err
}

func (r *RedisClient) Incr(ctx context.Context, key string) (int64, error) {
	val, err := r.client.Incr(ctx, key).Result()
	if err != nil {
		r.markDown(err)
	} else {
		r.markUp()
	}
	return val, err
}

func (r *RedisClient) Close() error {
	if r == nil || r.client == nil {
		return nil
	}
	return r.client.Close()
}
