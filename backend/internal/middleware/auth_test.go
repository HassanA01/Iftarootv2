package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-32-bytes-long-enough"

func makeToken(t *testing.T, adminID string, secret string, exp time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": adminID,
		"exp": exp.Unix(),
		"iat": time.Now().Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func TestRequireAuth(t *testing.T) {
	sentinel := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		adminID := GetAdminID(r.Context())
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(adminID))
	})

	handler := RequireAuth(testSecret)(sentinel)

	t.Run("no Authorization header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("malformed Authorization header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Basic abc123")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("invalid token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer not.a.jwt")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("token signed with wrong secret", func(t *testing.T) {
		tok := makeToken(t, "admin-123", "wrong-secret", time.Now().Add(time.Hour))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("expired token", func(t *testing.T) {
		tok := makeToken(t, "admin-123", testSecret, time.Now().Add(-time.Hour))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("valid token passes admin_id to context", func(t *testing.T) {
		tok := makeToken(t, "admin-abc", testSecret, time.Now().Add(time.Hour))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
		if w.Body.String() != "admin-abc" {
			t.Errorf("expected admin-abc in body, got %q", w.Body.String())
		}
	})
}
