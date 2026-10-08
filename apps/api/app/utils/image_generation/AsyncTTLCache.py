import asyncio
import time
from collections import OrderedDict
from typing import Awaitable, Callable, Generic, Hashable, TypeVar

T = TypeVar("T")


class AsyncTTLCache(Generic[T]):
    """
    In-memory cache for the result of an async call, bounded by size (LRU) and age.

    Concurrent calls for the same key share one in-flight call. A call that raises
    is not cached: the next caller tries again. Values are shared between callers,
    so they must be immutable (bytes, not PIL images).
    """

    def __init__(
        self,
        max_entries: int,
        ttl_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self._clock = clock
        # key -> (stored at, value or the task computing it)
        self._entries: OrderedDict[Hashable, tuple[float, T | asyncio.Task[T]]] = (
            OrderedDict()
        )

    async def get_or_fetch(self, key: Hashable, fetch: Callable[[], Awaitable[T]]) -> T:
        entry = self._entries.get(key)
        if entry is not None:
            stored_at, value = entry
            if self._clock() - stored_at > self.ttl_seconds or (
                # A task from another event loop (tests running asyncio.run twice)
                # can't be awaited here.
                isinstance(value, asyncio.Task)
                and value.get_loop() is not asyncio.get_running_loop()
            ):
                del self._entries[key]
            else:
                self._entries.move_to_end(key)
                if isinstance(value, asyncio.Task):
                    return await asyncio.shield(value)
                return value

        task = asyncio.ensure_future(fetch())
        self._store(key, task)
        task.add_done_callback(lambda done: self._settle(key, done))
        # Shielded: a cancelled caller doesn't cancel the others' fetch.
        return await asyncio.shield(task)

    def clear(self) -> None:
        self._entries.clear()

    def __len__(self) -> int:
        return len(self._entries)

    def _settle(self, key: Hashable, task: asyncio.Task[T]) -> None:
        """Keeps the result of a finished task, or forgets the key if it failed."""
        entry = self._entries.get(key)
        if entry is None or entry[1] is not task:
            return  # evicted or replaced meanwhile
        if task.cancelled() or task.exception() is not None:
            del self._entries[key]
        else:
            self._entries[key] = (entry[0], task.result())

    def _store(self, key: Hashable, value: T | asyncio.Task[T]) -> None:
        self._entries[key] = (self._clock(), value)
        self._entries.move_to_end(key)
        while len(self._entries) > self.max_entries:
            self._entries.popitem(last=False)
