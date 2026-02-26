CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE admins (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE quizzes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id   UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE questions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id    UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    time_limit INT NOT NULL DEFAULT 20,
    "order"    INT NOT NULL DEFAULT 0
);

CREATE TABLE options (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE game_sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id    UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    code       TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
    started_at TIMESTAMPTZ,
    ended_at   TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE game_players (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    score      INT NOT NULL DEFAULT 0,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, name)
);

CREATE TABLE game_answers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id   UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_id   UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    points      INT NOT NULL DEFAULT 0,
    UNIQUE (session_id, player_id, question_id)
);

CREATE INDEX idx_game_sessions_code ON game_sessions(code);
CREATE INDEX idx_game_players_session ON game_players(session_id);
CREATE INDEX idx_game_answers_session ON game_answers(session_id);
