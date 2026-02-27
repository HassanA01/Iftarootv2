package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateSession_Validation(t *testing.T) {
	h := newTestHandler()

	tests := []struct {
		name       string
		body       any
		wantStatus int
	}{
		{"empty body", map[string]string{}, http.StatusBadRequest},
		{"missing quiz_id", map[string]string{"quiz_id": ""}, http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := postJSON(t, h.CreateSession, tc.body)
			if w.Code != tc.wantStatus {
				t.Errorf("expected %d, got %d — body: %s", tc.wantStatus, w.Code, w.Body.String())
			}
		})
	}
}

func TestCreateSession_InvalidJSON(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.CreateSession(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestJoinSession_Validation(t *testing.T) {
	h := newTestHandler()

	tests := []struct {
		name       string
		body       any
		wantStatus int
	}{
		{"empty body", map[string]string{}, http.StatusBadRequest},
		{"missing name", map[string]string{"code": "123456"}, http.StatusBadRequest},
		{"missing code", map[string]string{"name": "Alice"}, http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := postJSON(t, h.JoinSession, tc.body)
			if w.Code != tc.wantStatus {
				t.Errorf("expected %d, got %d — body: %s", tc.wantStatus, w.Code, w.Body.String())
			}
		})
	}
}

func TestGenerateCode(t *testing.T) {
	codes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		code, err := generateCode()
		if err != nil {
			t.Fatalf("generateCode failed: %v", err)
		}
		if len(code) != 6 {
			t.Errorf("expected 6-digit code, got %q (len=%d)", code, len(code))
		}
		codes[code] = true
	}
	// With 100 samples from 1M possibilities, collision rate is negligible
	if len(codes) < 90 {
		t.Errorf("too many collisions: only %d unique codes in 100 attempts", len(codes))
	}
}
