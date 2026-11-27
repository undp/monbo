class FarmDefaults:
    """Default values used for farm data processing."""

    # Area in hectares of a point farm without one: the area TRACES assigns to it
    # (decision D6 of undp/monbo#192).
    DEFAULT_POINT_AREA_HECTARES = 4.0
    # Largest area a plot may be geolocated with as a point: a larger one must be a
    # polygon (Reg. (EU) 2023/1115, art. 2(28)).
    MAX_POINT_AREA_HECTARES = 4.0
