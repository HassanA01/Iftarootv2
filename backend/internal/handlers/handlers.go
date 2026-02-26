package handlers

import (
	"github.com/HassanA01/Iftarootv2/backend/internal/config"
	"github.com/HassanA01/Iftarootv2/backend/internal/hub"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Handler struct {
	db     *pgxpool.Pool
	redis  *redis.Client
	hub    *hub.Hub
	config *config.Config
}

func New(db *pgxpool.Pool, redisClient *redis.Client, gameHub *hub.Hub, cfg *config.Config) *Handler {
	return &Handler{
		db:     db,
		redis:  redisClient,
		hub:    gameHub,
		config: cfg,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/v1", func(r chi.Router) {
		// Auth
		r.Post("/auth/register", h.Register)
		r.Post("/auth/login", h.Login)

		// Quiz management (admin only)
		r.Group(func(r chi.Router) {
			r.Use(h.RequireAuth)
			r.Get("/quizzes", h.ListQuizzes)
			r.Post("/quizzes", h.CreateQuiz)
			r.Get("/quizzes/{quizID}", h.GetQuiz)
			r.Put("/quizzes/{quizID}", h.UpdateQuiz)
			r.Delete("/quizzes/{quizID}", h.DeleteQuiz)

			// Game session management
			r.Post("/sessions", h.CreateSession)
			r.Get("/sessions/{sessionID}", h.GetSession)
			r.Delete("/sessions/{sessionID}", h.EndSession)
		})

		// Player join (no auth)
		r.Post("/sessions/join", h.JoinSession)

		// WebSocket endpoints
		r.Get("/ws/host/{sessionCode}", h.HostWebSocket)
		r.Get("/ws/player/{sessionCode}", h.PlayerWebSocket)
	})
}
