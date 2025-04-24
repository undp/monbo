import logging
from typing import Optional

# Configure the base logger
logger = logging.getLogger("app")


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colored output"""

    COLORS = {
        "DEBUG": "\033[36m",  # cyan
        "INFO": "\033[32m",  # green
        "WARNING": "\033[33m",  # yellow
        "ERROR": "\033[31m",  # red
        "CRITICAL": "\033[41m\033[37m",  # white on red bg
    }
    RESET = "\033[0m"

    def format(self, record):
        log_message = super().format(record)
        color = self.COLORS.get(record.levelname, self.RESET)
        return f"{color}{log_message}{self.RESET}"


def get_logger(module_name: Optional[str] = None) -> logging.Logger:
    """
    Get a properly configured logger for the given module.

    Args:
        module_name: Optional suffix to append to the base logger name
            (e.g., 'utils.image_generation.GeometryHelper',
            'utils.image_generation.GoogleMapsAPIHelper')

    Returns:
        A configured logger instance
    """
    if module_name:
        return logging.getLogger(f"app.{module_name}")

    return logger


def configure_logging(level: int = logging.INFO) -> None:
    """
    Configure the image generation logger with handlers and formatting.
    This should be called once at application startup.

    Args:
        level: The logging level to set (default: INFO)
    """
    # Set the logging level
    logger.setLevel(level)

    # Avoid adding handlers if they already exist
    if not logger.handlers:
        # Create a console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)

        # Create a formatter and set it for the handler
        formatter = ColoredFormatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        )
        console_handler.setFormatter(formatter)

        # Add the handler to the logger
        logger.addHandler(console_handler)
