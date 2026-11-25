from urllib.parse import urlparse


def is_valid_url(url: str) -> bool:
    try:
        result = urlparse(url)
        # Check for scheme and netloc (e.g., http://example.com)
        return all([result.scheme in ("http", "https"), result.netloc])
    except Exception:
        return False
