import re


def parse_float_string(value: str | float | int, locale: str = "en") -> float:
    """
    Parses a string to float, handling both comma and dot as decimal separators,
    and removing thousands separators (comma, dot, or space).
    """
    if isinstance(value, float) or isinstance(value, int):
        return float(value)

    value = value.replace(" ", "")

    if locale == "en":
        # Valid examples: 1,234.56 or 1234.56 or 1,234 or 1234
        if not re.fullmatch(r"^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$", value):
            raise ValueError(f"Invalid number format for locale 'en': {value}")
        value = value.replace(",", "")
    elif locale == "es":
        # Valid examples: 1.234,56 or 1234,56 or 1.234 or 1234
        if not re.fullmatch(r"^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$", value):
            raise ValueError(f"Invalid number format for locale 'es': {value}")
        value = value.replace(".", "")
        value = value.replace(",", ".")
    else:
        raise ValueError(f"Unsupported locale: {locale}")

    return float(value)
