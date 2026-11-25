class NoRasterDataOverlapError(Exception):
    """Raised when the requested polygon doesn't overlap with the map's raster data."""

    pass


class MapGenerationError(Exception):
    """Base class for errors during map generation."""

    pass


class GeometryTypeError(MapGenerationError):
    """
    Raised when an unsupported geometry type is encountered.
    Currently only 'Polygon' and 'Point' geometry types are supported.
    """

    pass


class ParameterValidationError(MapGenerationError):
    """
    Raised when parameters fail validation.
    For example, when point_radius_meters is provided for Polygon geometries
    or missing for Point geometries.
    """

    pass


class GoogleMapsAPIError(MapGenerationError):
    """
    Raised when there's an error with the Google Maps API.
    This could be due to invalid API keys, quota limits, or network issues.
    """

    pass
