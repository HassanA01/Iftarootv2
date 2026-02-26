package handlers

import (
	"encoding/json"
	"net/http"

	appMiddleware "github.com/HassanA01/Iftarootv2/backend/internal/middleware"
	"github.com/HassanA01/Iftarootv2/backend/internal/models"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (h *Handler) ListQuizzes(w http.ResponseWriter, r *http.Request) {
	adminID := appMiddleware.GetAdminID(r.Context())
	rows, err := h.db.Query(r.Context(),
		`SELECT id, admin_id, title, created_at FROM quizzes WHERE admin_id = $1 ORDER BY created_at DESC`,
		adminID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list quizzes")
		return
	}
	defer rows.Close()

	var quizzes []models.Quiz
	for rows.Next() {
		var q models.Quiz
		if err := rows.Scan(&q.ID, &q.AdminID, &q.Title, &q.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan quiz")
			return
		}
		quizzes = append(quizzes, q)
	}
	if quizzes == nil {
		quizzes = []models.Quiz{}
	}
	writeJSON(w, http.StatusOK, quizzes)
}

type createQuizRequest struct {
	Title     string              `json:"title"`
	Questions []questionInputItem `json:"questions"`
}

type questionInputItem struct {
	Text      string             `json:"text"`
	TimeLimit int                `json:"time_limit"`
	Order     int                `json:"order"`
	Options   []optionInputItem  `json:"options"`
}

type optionInputItem struct {
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
}

func (h *Handler) CreateQuiz(w http.ResponseWriter, r *http.Request) {
	adminID := appMiddleware.GetAdminID(r.Context())

	var req createQuizRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	quizID := uuid.New()
	adminUUID, err := uuid.Parse(adminID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid admin id")
		return
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start transaction")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(),
		`INSERT INTO quizzes (id, admin_id, title) VALUES ($1, $2, $3)`,
		quizID, adminUUID, req.Title,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create quiz")
		return
	}

	for _, qi := range req.Questions {
		qID := uuid.New()
		_, err = tx.Exec(r.Context(),
			`INSERT INTO questions (id, quiz_id, text, time_limit, "order") VALUES ($1, $2, $3, $4, $5)`,
			qID, quizID, qi.Text, qi.TimeLimit, qi.Order,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create question")
			return
		}
		for _, oi := range qi.Options {
			_, err = tx.Exec(r.Context(),
				`INSERT INTO options (id, question_id, text, is_correct) VALUES ($1, $2, $3, $4)`,
				uuid.New(), qID, oi.Text, oi.IsCorrect,
			)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to create option")
				return
			}
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"id": quizID.String(), "title": req.Title})
}

func (h *Handler) GetQuiz(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "quizID")

	var quiz models.Quiz
	err := h.db.QueryRow(r.Context(),
		`SELECT id, admin_id, title, created_at FROM quizzes WHERE id = $1`, quizID,
	).Scan(&quiz.ID, &quiz.AdminID, &quiz.Title, &quiz.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "quiz not found")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, quiz_id, text, time_limit, "order" FROM questions WHERE quiz_id = $1 ORDER BY "order"`, quizID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load questions")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var q models.Question
		if err := rows.Scan(&q.ID, &q.QuizID, &q.Text, &q.TimeLimit, &q.Order); err != nil {
			continue
		}
		optRows, err := h.db.Query(r.Context(),
			`SELECT id, question_id, text, is_correct FROM options WHERE question_id = $1`, q.ID,
		)
		if err == nil {
			for optRows.Next() {
				var o models.Option
				_ = optRows.Scan(&o.ID, &o.QuestionID, &o.Text, &o.IsCorrect)
				q.Options = append(q.Options, o)
			}
			optRows.Close()
		}
		quiz.Questions = append(quiz.Questions, q)
	}

	writeJSON(w, http.StatusOK, quiz)
}

func (h *Handler) UpdateQuiz(w http.ResponseWriter, r *http.Request) {
	// TODO: implement full quiz update
	writeJSON(w, http.StatusOK, map[string]string{"status": "not yet implemented"})
}

func (h *Handler) DeleteQuiz(w http.ResponseWriter, r *http.Request) {
	quizID := chi.URLParam(r, "quizID")
	_, err := h.db.Exec(r.Context(), `DELETE FROM quizzes WHERE id = $1`, quizID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete quiz")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
