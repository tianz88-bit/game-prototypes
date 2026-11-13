-- Steroids-Alpha bank (BRIEF.md "Bank and unlocks").
-- Anonymous accounts: only SHA-256 hashes of the account secret and recovery code are stored.
-- A balance is the sum of its ledger rows; each row's id is unique (one per extraction run or
-- purchase), so a repeated credit can never pay twice.

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  recovery_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('extract', 'purchase')),
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX ledger_account ON ledger (account_id);

-- Unlocks bought with credits (filled by the unlock shop, the next milestone).
CREATE TABLE unlocks (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  unlock_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, unlock_id)
);
