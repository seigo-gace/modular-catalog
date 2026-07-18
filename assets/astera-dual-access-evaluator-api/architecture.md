# Architecture

SystemはHTTP、認証、制限、計測、監査、障害境界を所有する。Application SystemはStoreを配線して別Processを起動・停止する。依存方向は`Application System → System → Astera既存Feature/Part`であり、本体ServerをImportしない。
