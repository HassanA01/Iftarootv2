package handlers

import (
	"net/http"

	appMiddleware "github.com/HassanA01/Iftarootv2/backend/internal/middleware"
)

func (h *Handler) RequireAuth(next http.Handler) http.Handler {
	return appMiddleware.RequireAuth(h.config.JWTSecret)(next)
}
