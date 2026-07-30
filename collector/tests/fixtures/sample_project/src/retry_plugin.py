import time
from typing import Callable

class RetryAdapter:
    def run(self, operation: Callable[[], object], attempts: int = 3) -> object:
        for attempt in range(attempts):
            try:
                return operation()
            except Exception:
                if attempt + 1 == attempts:
                    raise
                time.sleep(2 ** attempt)
        raise RuntimeError("unreachable")

def register_plugin(registry: dict[str, object], name: str, plugin: object) -> None:
    registry[name] = plugin
