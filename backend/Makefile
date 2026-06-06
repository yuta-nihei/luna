# Builds the Luna Core sidecar binary into the Tauri binaries/ directory using
# the Tauri sidecar naming convention: <name>-<target-triple>[.exe].

BINARY := luna-core
PKG    := ./cmd/luna-core
OUT    := ../src-tauri/binaries

# Tauri resolves sidecars by Rust host target triple. Prefer an explicit
# TRIPLE=... override; otherwise derive it from rustc.
TRIPLE ?= $(shell rustc -vV 2>/dev/null | sed -n 's/host: //p')
EXT    :=
ifneq (,$(findstring windows,$(TRIPLE)))
	EXT := .exe
endif

.PHONY: build test fmt clean

build:
	@if [ -z "$(TRIPLE)" ]; then \
		echo "error: could not determine target triple. Install rustc or pass TRIPLE=<triple>."; \
		echo "  e.g. make build TRIPLE=x86_64-unknown-linux-gnu"; \
		exit 1; \
	fi
	@mkdir -p $(OUT)
	go build -trimpath -ldflags "-s -w" -o $(OUT)/$(BINARY)-$(TRIPLE)$(EXT) $(PKG)
	@echo "built $(OUT)/$(BINARY)-$(TRIPLE)$(EXT)"

test:
	go test ./...

fmt:
	go fmt ./...

clean:
	rm -f $(OUT)/$(BINARY)-*
