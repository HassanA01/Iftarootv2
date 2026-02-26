package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appMiddleware "github.com/HassanA01/Iftarootv2/backend/internal/middleware"
	"github.com/HassanA01/Iftarootv2/backend/internal/models"
)

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	adminID := appMiddleware.GetAdminID(r.Context())
	_ = adminID

	var req struct {
		QuizID string `json:"quiz_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	code, err := generateCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate session code")
		return
	}
	sessionID := uuid.New()

	_, err = h.db.Exec(r.Context(),
		`INSERT INTO game_sessions (id, quiz_id, code, status) VALUES ($1, $2, $3, $4)`,
		sessionID, req.QuizID, code, models.GameStatusWaiting,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"session_id": sessionID.String(),
		"code":       code,
	})
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	var session models.GameSession
	err := h.db.QueryRow(r.Context(),
		`SELECT id, quiz_id, code, status, started_at, ended_at, created_at FROM game_sessions WHERE id = $1`,
		sessionID,
	).Scan(&session.ID, &session.QuizID, &session.Code, &session.Status,
		&session.StartedAt, &session.EndedAt, &session.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (h *Handler) EndSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	now := time.Now()
	_, err := h.db.Exec(r.Context(),
		`UPDATE game_sessions SET status = $1, ended_at = $2 WHERE id = $3`,
		models.GameStatusFinished, now, sessionID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to end session")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) JoinSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Code == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "code and name are required")
		return
	}

	var session models.GameSession
	err := h.db.QueryRow(r.Context(),
		`SELECT id, quiz_id, code, status FROM game_sessions WHERE code = $1 AND status = $2`,
		req.Code, models.GameStatusWaiting,
	).Scan(&session.ID, &session.QuizID, &session.Code, &session.Status)
	if err != nil {
		writeError(w, http.StatusNotFound, "game not found or already started")
		return
	}

	playerID := uuid.New()
	_, err = h.db.Exec(r.Context(),
		`INSERT INTO game_players (id, session_id, name, score) VALUES ($1, $2, $3, 0)`,
		playerID, session.ID, req.Name,
	)
	if err != nil {
		writeError(w, http.StatusConflict, "name already taken in this game")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"player_id":  playerID.String(),
		"session_id": session.ID.String(),
		"code":       session.Code,
		"name":       req.Name,
	})
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
