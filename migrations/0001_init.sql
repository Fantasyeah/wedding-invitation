-- 婚礼赴约登记表
CREATE TABLE IF NOT EXISTS rsvps (
  id                  TEXT PRIMARY KEY,
  guest_name          TEXT NOT NULL,
  attendance          TEXT NOT NULL CHECK (attendance IN ('attending', 'declined')),
  party_size          INTEGER NOT NULL DEFAULT 0,
  needs_accommodation TEXT NOT NULL DEFAULT 'no' CHECK (needs_accommodation IN ('yes', 'no')),
  phone               TEXT,
  message             TEXT,
  edit_token_hash     TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rsvps_attendance     ON rsvps (attendance);
CREATE INDEX IF NOT EXISTS idx_rsvps_accommodation  ON rsvps (needs_accommodation);
CREATE INDEX IF NOT EXISTS idx_rsvps_updated_at     ON rsvps (updated_at);

-- RSVP 提交频率限制（按带密钥的 IP 哈希，不保存原始 IP）
CREATE TABLE IF NOT EXISTS rsvp_rate_limit (
  key_hash     TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

-- 管理后台登录失败次数（按带密钥的 IP 哈希，不保存原始 IP）
CREATE TABLE IF NOT EXISTS admin_login_failures (
  key_hash     TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
