from app.modules.deforestation_analysis import (
    module_router as deforestation_analysis_router,
)
from app.modules.maps import module_router as maps_router
from app.modules.polygons_validation import module_router as polygons_validation_router

__all__ = [
    "polygons_validation_router",
    "deforestation_analysis_router",
    "maps_router",
]
