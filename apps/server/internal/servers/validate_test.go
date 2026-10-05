package servers

import (
	"strings"
	"testing"
)

func TestValidateRejectsInvalid(t *testing.T) {
	valid := Input{
		Name:     "Production",
		Host:     "203.0.113.10",
		Port:     22,
		Username: "deploy",
		AuthType: AuthPassword,
		Password: "secret",
	}
	if err := Validate(valid, true); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name   string
		mut    func(*Input)
		want   string
		secret bool
	}{
		{"host", func(in *Input) { in.Host = "" }, "invalid host", true},
		{"port", func(in *Input) { in.Port = 0 }, "invalid port", true},
		{"username", func(in *Input) { in.Username = "" }, "username is required", true},
		{"auth", func(in *Input) { in.AuthType = "token" }, "invalid authentication type", true},
		{"password", func(in *Input) { in.Password = "" }, "password is required", true},
		{"key", func(in *Input) { in.AuthType = AuthPrivateKey; in.PrivateKey = "" }, "private key is required", true},
		{"bad ipv4", func(in *Input) { in.Host = "203.0.113.300" }, "invalid host", true},
		{"short ipv4", func(in *Input) { in.Host = "10.0.0" }, "invalid host", true},
		{"long name", func(in *Input) { in.Name = strings.Repeat("x", 65) }, "server name is too long", true},
		{"username space", func(in *Input) { in.Username = "de ploy" }, "invalid username", true},
		{"username at", func(in *Input) { in.Username = "root@host" }, "invalid username", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			in := valid
			tc.mut(&in)
			err := Validate(in, tc.secret)
			if err == nil || err.Error() != tc.want {
				t.Fatalf("got %v want %s", err, tc.want)
			}
		})
	}
}

func TestValidateAllowsMissingSecretWhenNotRequired(t *testing.T) {
	in := Input{
		Name:     "Production",
		Host:     "example.com",
		Port:     22,
		Username: "ubuntu",
		AuthType: AuthPassword,
	}
	if err := Validate(in, false); err != nil {
		t.Fatal(err)
	}
}
