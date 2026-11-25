import asyncio

from app.utils.image_generation.AsyncTTLCache import AsyncTTLCache


class Fetcher:
    """Counts its calls; each call takes a moment, so concurrent ones overlap."""

    def __init__(self, fail_times: int = 0):
        self.calls = 0
        self.fail_times = fail_times

    async def __call__(self) -> bytes:
        self.calls += 1
        await asyncio.sleep(0.01)
        if self.calls <= self.fail_times:
            raise RuntimeError("Google is down")
        return b"image"


def test_concurrent_calls_share_one_fetch():
    cache: AsyncTTLCache[bytes] = AsyncTTLCache(max_entries=8, ttl_seconds=60)
    fetch = Fetcher()

    async def run():
        return await asyncio.gather(
            *(cache.get_or_fetch("farm", fetch) for _ in range(3))
        )

    assert asyncio.run(run()) == [b"image"] * 3
    assert fetch.calls == 1


def test_sequential_calls_hit_the_cache():
    cache: AsyncTTLCache[bytes] = AsyncTTLCache(max_entries=8, ttl_seconds=60)
    fetch = Fetcher()

    async def run():
        for _ in range(3):
            assert await cache.get_or_fetch("farm", fetch) == b"image"

    asyncio.run(run())
    assert fetch.calls == 1


def test_a_failure_is_not_cached():
    cache: AsyncTTLCache[bytes] = AsyncTTLCache(max_entries=8, ttl_seconds=60)
    fetch = Fetcher(fail_times=1)

    async def run():
        # Both concurrent callers see the failure of the one fetch...
        results = await asyncio.gather(
            cache.get_or_fetch("farm", fetch),
            cache.get_or_fetch("farm", fetch),
            return_exceptions=True,
        )
        assert all(isinstance(r, RuntimeError) for r in results)
        assert fetch.calls == 1
        # ...and the next request tries again.
        assert await cache.get_or_fetch("farm", fetch) == b"image"

    asyncio.run(run())
    assert fetch.calls == 2


def test_least_recently_used_entries_are_evicted():
    cache: AsyncTTLCache[bytes] = AsyncTTLCache(max_entries=2, ttl_seconds=60)
    fetch = Fetcher()

    async def run():
        await cache.get_or_fetch("a", fetch)
        await cache.get_or_fetch("b", fetch)
        await cache.get_or_fetch("a", fetch)  # "b" is now the oldest
        await cache.get_or_fetch("c", fetch)
        assert fetch.calls == 3
        await cache.get_or_fetch("a", fetch)
        assert fetch.calls == 3
        await cache.get_or_fetch("b", fetch)
        assert fetch.calls == 4

    asyncio.run(run())
    assert len(cache) == 2


def test_entries_expire():
    now = [1000.0]
    cache: AsyncTTLCache[bytes] = AsyncTTLCache(
        max_entries=8, ttl_seconds=600, clock=lambda: now[0]
    )
    fetch = Fetcher()

    async def run():
        await cache.get_or_fetch("farm", fetch)
        now[0] += 599
        await cache.get_or_fetch("farm", fetch)
        assert fetch.calls == 1
        now[0] += 2  # 601 s after the fetch
        await cache.get_or_fetch("farm", fetch)
        assert fetch.calls == 2

    asyncio.run(run())


def test_a_cancelled_caller_does_not_cancel_the_others():
    cache: AsyncTTLCache[bytes] = AsyncTTLCache(max_entries=8, ttl_seconds=60)
    fetch = Fetcher()

    async def run():
        first = asyncio.ensure_future(cache.get_or_fetch("farm", fetch))
        second = asyncio.ensure_future(cache.get_or_fetch("farm", fetch))
        await asyncio.sleep(0)
        first.cancel()
        assert await second == b"image"
        assert await cache.get_or_fetch("farm", fetch) == b"image"

    asyncio.run(run())
    assert fetch.calls == 1
