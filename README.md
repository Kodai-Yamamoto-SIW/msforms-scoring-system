# アンケート採点システム（Forms / Track Training 対応）

Microsoft Forms または Track Training のデータ（Excel/CSV）を読み込み、回答をプレビューして採点を行うWebアプリケーションです。

## 機能

### 現在実装済み
- ✅ Microsoft Forms / Track Training の Excel/CSV アップロード機能
- ✅ 回答データの解析とプレビュー機能
- ✅ 一人ずつの回答表示（前へ/次へナビゲーション）
- ✅ 基本情報（ID、名前、メール、時刻）の表示
- ✅ 問題と回答の対応表示

### 今後実装予定
- 採点基準の設定機能
- 二択評価インターフェース（基準を満たす/満たさない）
- 点数計算機能
- 採点結果のエクスポート機能

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **Excel処理**: xlsx
- **ファイルアップロード**: react-dropzone
- **リンティング**: ESLint

## セットアップ

1. 依存関係のインストール：
```bash
npm install
```

2. 開発サーバーの起動：
```bash
npm run dev
```

3. ブラウザで http://localhost:3000 にアクセス

## 使用方法

1. Microsoft Forms または Track Training の Excel/CSV ファイル（.xlsx / .xls / .csv）をドラッグ&ドロップまたはクリックしてアップロード
2. 回答データが自動で解析され、プレビュー画面が表示されます
3. 「前へ」「次へ」ボタンで回答者を切り替えて内容を確認できます

## 入力データ形式

- Microsoft Forms 形式（Excel/CSV）
	- 1行目：ヘッダー（ID, 開始時刻, 完了時刻, メール, 名前, 問題文1, 問題文2, ...）
	- 2行目以降：回答データ（IDが空になるまで）

- Track Training 形式（CSV想定）
	- 基本情報の列: traineeId, startAt, endAt, account, traineeName
	- 回答の列: q1/answer, q2/answer, ...（問題文は含まれません）
	- 本アプリでは質問ラベルを q1, q2, ... として扱います

## 開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント実行
npm run lint
```
