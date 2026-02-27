package game

import (
	"testing"
	"time"
)

func TestBuildQuestionPayload(t *testing.T) {
	q := storedQuestion{
		ID:        "q1",
		Text:      "What is 2+2?",
		TimeLimit: 20,
		Options: []storedOption{
			{ID: "o1", Text: "3", IsCorrect: false},
			{ID: "o2", Text: "4", IsCorrect: true},
			{ID: "o3", Text: "5", IsCorrect: false},
		},
	}

	payload := buildQuestionPayload(q, 0, 5)

	if payload["question_index"] != 0 {
		t.Errorf("expected question_index=0, got %v", payload["question_index"])
	}
	if payload["total_questions"] != 5 {
		t.Errorf("expected total_questions=5, got %v", payload["total_questions"])
	}

	inner, ok := payload["question"].(map[string]any)
	if !ok {
		t.Fatal("question field missing or wrong type")
	}
	if inner["id"] != "q1" {
		t.Errorf("expected id=q1, got %v", inner["id"])
	}
	opts, ok := inner["options"].([]map[string]string)
	if !ok {
		t.Fatal("options field missing or wrong type")
	}
	for _, opt := range opts {
		if _, hasCorrect := opt["is_correct"]; hasCorrect {
			t.Error("player question payload must not include is_correct")
		}
	}
}

func TestBuildHostQuestionPayload(t *testing.T) {
	q := storedQuestion{
		ID:        "q1",
		Text:      "Capital of France?",
		TimeLimit: 15,
		Options: []storedOption{
			{ID: "o1", Text: "London", IsCorrect: false},
			{ID: "o2", Text: "Paris", IsCorrect: true},
		},
	}

	payload := BuildHostQuestionPayload(q, 2, 10)

	inner, ok := payload["question"].(map[string]any)
	if !ok {
		t.Fatal("question field missing")
	}
	opts, ok := inner["options"].([]map[string]any)
	if !ok {
		t.Fatal("options field wrong type")
	}
	if len(opts) != 2 {
		t.Fatalf("expected 2 options, got %d", len(opts))
	}
	if opts[0]["is_correct"] != false {
		t.Error("expected first option is_correct=false")
	}
	if opts[1]["is_correct"] != true {
		t.Error("expected second option is_correct=true")
	}
}

func TestCalculatePointsTiming(t *testing.T) {
	// Verify that earlier answers score more points.
	fast := CalculatePoints(1, 20)
	slow := CalculatePoints(15, 20)
	if fast <= slow {
		t.Errorf("fast answer (%d) should score more than slow (%d)", fast, slow)
	}
	if fast > BasePoints {
		t.Errorf("points (%d) should not exceed BasePoints (%d)", fast, BasePoints)
	}
	if slow < 0 {
		t.Errorf("points should not be negative, got %d", slow)
	}
}

func TestGameStateFields(t *testing.T) {
	state := GameState{
		SessionCode:     "123456",
		SessionID:       "sess-id",
		CurrentIndex:    2,
		TotalQuestions:  5,
		Phase:           PhaseQuestion,
		QuestionStarted: time.Now(),
	}
	if state.Phase != PhaseQuestion {
		t.Errorf("expected phase %s, got %s", PhaseQuestion, state.Phase)
	}
	if state.CurrentIndex != 2 {
		t.Errorf("expected index 2, got %d", state.CurrentIndex)
	}
}

func TestPhaseConstants(t *testing.T) {
	phases := []GamePhase{PhaseStarting, PhaseQuestion, PhaseReveal, PhaseLeaderboard, PhaseGameOver}
	seen := make(map[GamePhase]bool)
	for _, p := range phases {
		if seen[p] {
			t.Errorf("duplicate phase value: %s", p)
		}
		seen[p] = true
		if p == "" {
			t.Error("phase value must not be empty string")
		}
	}
}
