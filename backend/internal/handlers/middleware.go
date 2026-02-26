package handlers

import (
	"net/http"
	"strings"

	appMiddleware "github.com/HassanA01/Iftarootv2/backend/internal/middleware"
	"github.com/golang-jwt/jwt/v5"
)

func (h *Handler) RequireAuth(next http.Handler) http.Handler {
	return appMiddleware.RequireAuth(h.config.JWTSecret)(next)
}

func (h *Handler) parseAdminID(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return ""
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		return []byte(h.config.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return ""
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}
	sub, _ := claims["sub"].(string)
	return sub
}
