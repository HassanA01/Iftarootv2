package hub

import "testing"

func newTestHub() *Hub {
	return New(nil) // nil redis is fine for non-Redis methods
}

func TestBroadcastToHost(t *testing.T) {
	h := newTestHub()

	hostSend := make(chan []byte, 4)
	playerSend := make(chan []byte, 4)

	host := &Client{ID: "host-1", IsHost: true, Send: hostSend}
	player := &Client{ID: "player-1", IsHost: false, Send: playerSend}

	h.JoinRoom("ROOM1", host)
	h.JoinRoom("ROOM1", player)

	h.BroadcastToHost("ROOM1", Message{Type: MsgQuestion, Payload: map[string]any{"q": 1}})

	if len(hostSend) != 1 {
		t.Errorf("host should receive 1 message, got %d", len(hostSend))
	}
	if len(playerSend) != 0 {
		t.Errorf("player should receive 0 messages, got %d", len(playerSend))
	}
}

func TestBroadcastToPlayers(t *testing.T) {
	h := newTestHub()

	hostSend := make(chan []byte, 4)
	p1Send := make(chan []byte, 4)
	p2Send := make(chan []byte, 4)

	host := &Client{ID: "host-1", IsHost: true, Send: hostSend}
	p1 := &Client{ID: "player-1", IsHost: false, Send: p1Send}
	p2 := &Client{ID: "player-2", IsHost: false, Send: p2Send}

	h.JoinRoom("ROOM2", host)
	h.JoinRoom("ROOM2", p1)
	h.JoinRoom("ROOM2", p2)

	h.BroadcastToPlayers("ROOM2", Message{Type: MsgQuestion, Payload: map[string]any{"q": 1}})

	if len(hostSend) != 0 {
		t.Errorf("host should receive 0 messages, got %d", len(hostSend))
	}
	if len(p1Send) != 1 {
		t.Errorf("player1 should receive 1 message, got %d", len(p1Send))
	}
	if len(p2Send) != 1 {
		t.Errorf("player2 should receive 1 message, got %d", len(p2Send))
	}
}

func TestBroadcastToHostEmptyRoom(t *testing.T) {
	h := newTestHub()
	// Should not panic on empty/unknown room.
	h.BroadcastToHost("NOROOM", Message{Type: MsgQuestion, Payload: nil})
}

func TestBroadcastToPlayersNoPlayers(t *testing.T) {
	h := newTestHub()

	hostSend := make(chan []byte, 4)
	host := &Client{ID: "host-1", IsHost: true, Send: hostSend}
	h.JoinRoom("ROOM3", host)

	h.BroadcastToPlayers("ROOM3", Message{Type: MsgQuestion, Payload: nil})

	if len(hostSend) != 0 {
		t.Errorf("host should not receive player broadcast, got %d", len(hostSend))
	}
}
