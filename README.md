# Luna Editor

軽量・高速・キーボードファーストな開発者向けコードエディタ。
Tauri (Rust shell) + React/TypeScript UI + Go core。

> **Status:** 土台 + 縦切り1本が動作。
> 「フォルダを開く → ファイルツリー → エディタで表示 → 左パレットでコマンド実行」を
> `UI → Command → Service → Rust ブリッジ → Go サイドカー → OS` の全層で実証済み。

---

## アーキテクチャ

```
React UI  ──► Command 層 ──► Services ──► invoke("core_request")
(src/ui)      (src/commands)  (src/services)        │
                                                     ▼
                                      Rust ブリッジ (src-tauri) ── stdio JSON-RPC ──►
                                                     │
                                                     ▼
                                            Go コア (backend) ──► OS
                                      fs / palette / command / …
```

- **Rust (`src-tauri/`)** は Infrastructure 層に徹し、ロジックを持たない。唯一の
  コマンド `core_request` が全 Core 呼び出しを Go サイドカーへ転送する。
- **Go コア (`backend/`)** は単独バイナリ。stdio 上の改行区切り JSON-RPC で通信。
  ファイル操作・検索・Git・ターミナル等を担当する（CLAUDE.md / architecture.md）。
- 設定は `~/.luna/`（例: `palette.json`）に人間が直接編集できる JSON で保存。

### ディレクトリ

```
src/         React フロントエンド (ui / commands / services / store / themes / types / core)
src-tauri/   Tauri Rust シェル（サイドカー起動 + core_request ブリッジ）
backend/     Go コア（cmd/luna-core + filesystem/palette/command/… + 次スライス用の空パッケージ）
scripts/     gen-icons.mjs（プレースホルダアイコン生成）
docs/        設計ドキュメント
```

---

## 前提ツール

| ツール | バージョン | 用途 |
|---|---|---|
| Node.js | 18+ / 20+ | フロントエンド |
| pnpm | 9.x | パッケージ管理（`corepack` 経由を推奨） |
| Go | 1.22+ | コアサイドカー |
| Rust + Cargo | stable | Tauri シェルのビルド |
| make | 任意 | サイドカービルドの補助（無くても可、下記参照） |

### Go のインストール（macOS）

```sh
brew install go
go version   # go1.22 以上であること
```

### Linux のシステム依存（Tauri 2）

Tauri デスクトップをビルド/実行するには WebKitGTK 等が必要（Debian/Ubuntu 系）:

```sh
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

macOS は Xcode Command Line Tools、Windows は Visual Studio C++ Build Tools と WebView2。

---

## セットアップと起動

```sh
# 1) pnpm を用意（corepack 経由）
corepack enable            # 失敗する環境では: corepack pnpm@9 <cmd> で代用

# 2) フロントエンド依存をインストール
pnpm install

# 3) Go コアサイドカーをビルド（Tauri の命名規則どおり binaries/ へ出力）
make -C backend build                                  # rustc から triple を自動検出
# make が無い場合は直接ビルド（triple は rustc -vV の host: 値）:
#   cd backend && go build -trimpath -ldflags "-s -w" \
#     -o ../src-tauri/binaries/luna-core-$(rustc -vV | sed -n 's/host: //p') ./cmd/luna-core

# 4) 開発起動（Vite + Tauri）
pnpm tauri dev
```

> アイコンはプレースホルダ（`scripts/gen-icons.mjs` 生成）。本番用は
> `pnpm tauri icon path/to/logo.png` で一括生成できる。

### 動作確認（縦切り）

1. 起動すると Luna のウェルカム画面（ショートカット一覧）が表示される。
2. **Ctrl+O** または左パレット上部のフォルダボタンでフォルダを開く → 左にファイルツリー。
3. ツリーのファイルをクリック → タブが開き CodeMirror で内容表示・編集。
4. 左パレットのボタン（`Echo Hello` / `Git Status` / `List Files`）をクリック →
   下部ターミナルにコマンド出力。
   - **Ctrl+B** ファイルツリー開閉 / **Ctrl+`** ターミナル開閉 / **Ctrl+S** 保存。

### Emmet（HTML / CSS / JSX）

対応ファイル（`.html` / `.css` / `.js` / `.jsx` / `.tsx`）で Emmet 略語が使える。

1. `.html` を開き `div.container>ul>li*3` と入力 → **Tab** で展開。
2. 展開できない位置では **Tab** が通常のインデントになる。
3. **Ctrl+E**（macOS は **Cmd+E**）で abbreviation mode、**Ctrl+Shift+A** で Wrap、
   **Ctrl+Shift+T** でタグペア移動、**Ctrl+/** で Toggle Comment。

---

## このスライスの範囲

**含む:** Tauri+React+Go の足場、Go サイドカー（`fs.listDir` / `fs.readFile` /
`palette.load` / `command.run`）、Rust ブリッジ、左パレット、ファイルツリー、
タブ、CodeMirror エディタ（編集・保存）、Emmet 略語展開と主要アクション、
ワンショットコマンド出力、Luna Dark テーマ。

**含まない（次スライス）:** コマンドパレット (Ctrl+Shift+P)、
ripgrep 検索、Git 統合、インタラクティブ PTY ターミナル、Luna Light テーマ、設定 UI、
セッション復元、Basket、AI、セキュアストレージ。各機能は確立済みの縦軸
（新 Go メソッド + サービス + コマンド + UI）に沿って追加する。

---

## 検証

```sh
# Go コア（ユニットテスト + vet + フォーマット）
cd backend && go test ./... && go vet ./... && gofmt -l .

# フロントエンド（strict 型チェック + 本番ビルド）
pnpm typecheck
pnpm build
```

このリポジトリでは Go テスト・`tsc`・`vite build` が通ることを確認済み。
Tauri シェル（Rust）のビルド・GUI 通し確認は WebKitGTK + ディスプレイのある
環境で `pnpm tauri dev` により実施する。
