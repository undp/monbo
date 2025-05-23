from app.modules.maps import module_router as maps_router
from app.modules.farms import module_router as farms_router
from app.modules.polygons_validation import module_router as polygons_validation_router
from app.modules.deforestation_analysis import (
    module_router as deforestation_analysis_router,
)

__all__ = [
    "maps_router",
    "farms_router",
    "polygons_validation_router",
    "deforestation_analysis_router",
]
