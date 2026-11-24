# 261124 — 5歳の子が指1本で遊ぶ、文字のないWebゲーム集

`games/<id>/` に1本ずつ置く（ビルドなしの素のES Modules、外部通信なし）。`site/` は公開側の仕組みが管理するので触らない。

## 守ること
- 画面に文字・数字を出さない（`fillText` 禁止）。お話は絵・表情・音で伝える。失敗・時間制限・点数なし。
- iPhone / iPad Safari、指1本。縦でも横でも成立させ、回転に追従する。
- `index.html` に `<meta name="robots" content="noindex">`。`thumb.png` は実際の画面から作る（800x600）。
- 触ったら必ず何かが返る（波紋＋音）。ヒントの手は対象の上で動きを見せる。
- Safari対策: `ctx.filter` と毎フレームの `shadowBlur` / `getImageData` は使わない。音は最初の pointerup / touchend で解錠。動画は muted のまま再生し、音は Web Audio 側で鳴らす。

## games/261124-41「おてつだいカレー」
- `js/engine.js` 単位系（短辺=1000）・入力・時計 / `js/layout.js` 主役と脇役と顔ワイプの配置 / `js/fx.js` 影・湯気・ヒント / `js/bubbles.js` 顔ワイプ / `js/potview.js` 鍋とカレーへの変化 / `js/scenes/*.js` 場面ごと / `js/audio.js` 合成効果音とBGM。
- 画像は `assets/*.webp`、寸法と当たり位置は `assets/manifest.json`。
- 確認用: `?scene=<title|home|wash|cut|stamp|pot|roux|serve|eat|end>`、`?mute=1`、`?novideo=1`、`window.__game`。

## 素材づくり
- `tools/sd.sh`（写実画像の生成・1回3クレジット）、`tools/cut.py`（背景の切り抜き）、`tools/balance.sh`（残高）。真上アングルで単体を生成 → 切り抜き → 実行時に影をつけて合成、が写実に見える定石。
- 画像から3Dモデルへの変換は質が足りず不採用。同一人物の表情違いは1枚にまとめて出せなかった。
