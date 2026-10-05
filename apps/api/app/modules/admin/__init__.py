from fastapi import APIRouter, Depends

from app.modules.admin.auth import check_origin
from app.modules.admin.layers import router as layers_router
from app.modules.admin.rasters import router as rasters_router
from app.modules.admin.router import router

# Every admin route, login included, only accepts the configured frontend origin.
module_router = APIRouter(dependencies=[Depends(check_origin)])

module_router.include_router(router, prefix="/admin", tags=["Admin Module"])
module_router.include_router(
    layers_router, prefix="/admin/layers", tags=["Admin Module"]
)
module_router.include_router(rasters_router, prefix="/admin", tags=["Admin Module"])
