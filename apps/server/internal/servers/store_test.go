package servers

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"serverui/server/internal/db"
)

func TestRebindSQLiteKeepsPlaceholderNumbers(t *testing.T) {
	got := rebindSQLite("UPDATE t SET a=$2, b=$10 WHERE id=$1")
	want := "UPDATE t SET a=?2, b=?10 WHERE id=?1"
	if got != want {
		t.Fatalf("rebindSQLite = %q, want %q", got, want)
	}
}

// Regression: Update binds arguments out of order, which matched no row on SQLite.
func TestSQLiteStoreUpdatePersists(t *testing.T) {
	ctx := context.Background()
	sqlDB, err := db.OpenConfig(db.Config{
		Backend:    db.StorageSQLite,
		SQLitePath: filepath.Join(t.TempDir(), "serverui.db"),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.MigrateBackend(ctx, sqlDB, db.StorageSQLite); err != nil {
		t.Fatal(err)
	}
	store := NewSQLStoreBackend(sqlDB, db.StorageSQLite)

	now := time.Now().UTC()
	rec := Record{
		ID: "srv-1", Name: "Prod", Host: "203.0.113.10", Port: 22,
		Username: "deploy", AuthType: AuthPassword, Status: StatusUnknown,
		CreatedAt: now, UpdatedAt: now,
	}
	cred := Credential{
		ID: "cred-1", ServerID: rec.ID, AuthType: AuthPassword,
		EncryptedSecret: "x", CreatedAt: now, UpdatedAt: now,
	}
	if err := store.Create(ctx, rec, cred); err != nil {
		t.Fatal(err)
	}

	rec.Name = "Production"
	rec.Status = StatusOnline
	rec.UpdatedAt = now.Add(time.Minute)
	if err := store.Update(ctx, rec); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, err := store.Get(ctx, rec.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Production" || got.Status != StatusOnline {
		t.Fatalf("update not persisted: name=%q status=%q", got.Name, got.Status)
	}
}
