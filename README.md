# SDMS - Super Duper Minesweeper (Archived)

## Description

💣リアルタイムで他者と対戦できるマインスイーパー💣

作成: 2020年

最終動作確認: 2023年

## DEV
`npm run dev`で以下を実行  
- 更新に応じてサーバー再起動(port:3000)
- scssを圧縮しないでcssに変換

（デプロイ前）`npm run prod`で以下を実行
- scssを圧縮して変換

`npm start`はサーバー起動のみ. herokuが実行する

## note
- 開発時には環境変数`NODE_ENV`を`development`にしておくと、`<html data-env="development">`となる
- タイトルを押すとサーバーのデバッグ関数が発火したり、爆弾がすべて見えたりする
- クライアントサイドで`devlog()`が使える
