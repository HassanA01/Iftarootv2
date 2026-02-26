package game

import "math"

const (
	BasePoints    = 1000
	MinPoints     = 0
	StreakBonus   = 100
)

// CalculatePoints returns points for a correct answer.
// elapsed is seconds taken to answer, timeLimit is the question time limit.
// Faster answers score closer to BasePoints; minimum is MinPoints.
func CalculatePoints(elapsed float64, timeLimit int) int {
	if timeLimit <= 0 {
		return BasePoints
	}
	ratio := math.Max(0, 1.0-(elapsed/float64(timeLimit)))
	points := int(math.Round(float64(BasePoints) * ratio))
	if points < MinPoints {
		return MinPoints
	}
	return points
}
