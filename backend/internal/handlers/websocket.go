package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/HassanA01/Iftarootv2/backend/internal/hub"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS is handled at the router level
	},
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

func (h *Handler) HostWebSocket(w http.ResponseWriter, r *http.Request) {
	sessionCode := chi.URLParam(r, "sessionCode")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	client := &hub.Client{
		ID:        uuid.New().String(),
		SessionID: sessionCode,
		IsHost:    true,
		Send:      make(chan []byte, 256),
	}
	h.hub.JoinRoom(sessionCode, client)
	defer func() {
		h.hub.LeaveRoom(sessionCode, client)
		conn.Close()
	}()

	go writePump(conn, client)
	readPump(conn, client, h, sessionCode, true)
}

func (h *Handler) PlayerWebSocket(w http.ResponseWriter, r *http.Request) {
	sessionCode := chi.URLParam(r, "sessionCode")
	playerID := r.URL.Query().Get("player_id")
	playerName := r.URL.Query().Get("name")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	client := &hub.Client{
		ID:        playerID,
		SessionID: sessionCode,
		IsHost:    false,
		Send:      make(chan []byte, 256),
	}
	h.hub.JoinRoom(sessionCode, client)
	defer func() {
		h.hub.LeaveRoom(sessionCode, client)
		conn.Close()
		// Notify host that player left
		h.hub.Broadcast(sessionCode, hub.Message{
			Type: hub.MsgPlayerLeft,
			Payload: map[string]string{
				"player_id": playerID,
				"name":      playerName,
			},
		})
	}()

	// Notify room of new player
	h.hub.Broadcast(sessionCode, hub.Message{
		Type: hub.MsgPlayerJoined,
		Payload: map[string]string{
			"player_id": playerID,
			"name":      playerName,
		},
	})

	go writePump(conn, client)
	readPump(conn, client, h, sessionCode, false)
}

func readPump(conn *websocket.Conn, client *hub.Client, h *Handler, sessionCode string, isHost bool) {
	defer conn.Close()
	conn.SetReadLimit(maxMessageSize)
	_ = conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws read error: %v", err)
			}
			break
		}

		var msg hub.Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("ws unmarshal error: %v", err)
			continue
		}

		handleMessage(h, client, sessionCode, isHost, msg)
	}
}

func writePump(conn *websocket.Conn, client *hub.Client) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()
	for {
		select {
		case message, ok := <-client.Send:
			_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			_, _ = w.Write(message)
			// Flush queued messages
			n := len(client.Send)
			for i := 0; i < n; i++ {
				_, _ = w.Write([]byte("\n"))
				_, _ = w.Write(<-client.Send)
			}
			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func handleMessage(h *Handler, client *hub.Client, sessionCode string, isHost bool, msg hub.Message) {
	// Message routing: host and player actions handled here.
	// Full game orchestration logic will be implemented in the game engine.
	switch msg.Type {
	case hub.MsgPing:
		data, _ := json.Marshal(hub.Message{Type: hub.MsgPing, Payload: "pong"})
		select {
		case client.Send <- data:
		default:
		}
	default:
		log.Printf("unhandled message type: %s from isHost=%v", msg.Type, isHost)
	}
}
