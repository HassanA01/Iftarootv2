package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/HassanA01/Iftarootv2/backend/internal/hub"
	appMiddleware "github.com/HassanA01/Iftarootv2/backend/internal/middleware"
	"github.com/HassanA01/Iftarootv2/backend/internal/models"
)

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	adminID := appMiddleware.GetAdminID(r.Context())

	var req struct {
		QuizID string `json:"quiz_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.QuizID == "" {
		writeError(w, http.StatusBadRequest, "quiz_id is required")
		return
	}

	// Verify quiz exists and belongs to this admin
	var exists bool
	err := h.db.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM quizzes WHERE id = $1 AND admin_id = $2)`,
		req.QuizID, adminID,
	).Scan(&exists)
	if err != nil || !exists {
		writeError(w, http.StatusNotFound, "quiz not found")
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

	// Fetch the session code so we can notify WebSocket clients.
	var code string
	_ = h.db.QueryRow(r.Context(),
		`SELECT code FROM game_sessions WHERE id = $1`, sessionID,
	).Scan(&code)

	_, err := h.db.Exec(r.Context(),
		`UPDATE game_sessions SET status = $1, ended_at = $2 WHERE id = $3`,
		models.GameStatusFinished, now, sessionID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to end session")
		return
	}

	// Notify all WebSocket clients and clean up Redis.
	if code != "" {
		h.engine.EndGame(context.Background(), code)
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
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeError(w, http.StatusConflict, "name already taken in this game")
		} else {
			writeError(w, http.StatusInternalServerError, "failed to join game")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"player_id":  playerID.String(),
		"session_id": session.ID.String(),
		"code":       session.Code,
		"name":       req.Name,
	})
}

func (h *Handler) GetSessionByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	var session models.GameSession
	err := h.db.QueryRow(r.Context(),
		`SELECT id, quiz_id, code, status, started_at, ended_at, created_at FROM game_sessions WHERE code = $1`,
		code,
	).Scan(&session.ID, &session.QuizID, &session.Code, &session.Status,
		&session.StartedAt, &session.EndedAt, &session.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (h *Handler) ListSessionPlayers(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	rows, err := h.db.Query(r.Context(),
		`SELECT id, session_id, name, score, joined_at FROM game_players WHERE session_id = $1 ORDER BY joined_at ASC`,
		sessionID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list players")
		return
	}
	defer rows.Close()

	players := make([]models.GamePlayer, 0)
	for rows.Next() {
		var p models.GamePlayer
		if err := rows.Scan(&p.ID, &p.SessionID, &p.Name, &p.Score, &p.JoinedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read players")
			return
		}
		players = append(players, p)
	}
	writeJSON(w, http.StatusOK, players)
}

func (h *Handler) StartSession(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	now := time.Now()

	var session models.GameSession
	err := h.db.QueryRow(r.Context(),
		`UPDATE game_sessions SET status = $1, started_at = $2 WHERE id = $3 AND status = $4
		 RETURNING id, quiz_id, code, status, started_at, ended_at, created_at`,
		models.GameStatusActive, now, sessionID, models.GameStatusWaiting,
	).Scan(&session.ID, &session.QuizID, &session.Code, &session.Status,
		&session.StartedAt, &session.EndedAt, &session.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "session not found or already started")
		return
	}

	h.hub.Broadcast(session.Code, hub.Message{
		Type:    hub.MsgGameStarted,
		Payload: map[string]string{"session_id": session.ID.String()},
	})

	// Kick off the game engine in a goroutine with a background context.
	// r.Context() is cancelled when the HTTP response is sent, so we must not use it here.
	go func() {
		if err := h.engine.StartGame(context.Background(), session.Code, session.ID.String(), session.QuizID.String()); err != nil {
			log.Printf("engine.StartGame error: %v", err)
		}
	}()

	writeJSON(w, http.StatusOK, session)
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
