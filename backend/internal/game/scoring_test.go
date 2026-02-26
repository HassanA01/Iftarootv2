package game

import "testing"

func TestCalculatePoints(t *testing.T) {
	tests := []struct {
		name      string
		elapsed   float64
		timeLimit int
		wantMin   int
		wantMax   int
	}{
		{"instant answer", 0, 20, 990, 1000},
		{"half time", 10, 20, 490, 510},
		{"at limit", 20, 20, 0, 0},
		{"over limit", 25, 20, 0, 0},
		{"zero time limit", 5, 0, 1000, 1000},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := CalculatePoints(tc.elapsed, tc.timeLimit)
			if got < tc.wantMin || got > tc.wantMax {
				t.Errorf("CalculatePoints(%v, %v) = %v, want [%v, %v]",
					tc.elapsed, tc.timeLimit, got, tc.wantMin, tc.wantMax)
			}
		})
	}
}
