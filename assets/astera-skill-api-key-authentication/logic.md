# Logic

専用Keyを32〜256文字に限定し、公開Keyとの一致を一定時間比較で拒否する。候補Keyも欠落と最大長を先に拒否し、同一長の場合だけ`crypto.timingSafeEqual`で比較する。完全一致した場合だけ固定の専用Identityを返す。
