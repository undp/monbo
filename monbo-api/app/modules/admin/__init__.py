from fastapi import APIRouter, Depends

from app.modules.admin.auth import check_origin
from app.modules.admin.router import router

# Every admin route, login included, only accepts the configured frontend origin.
module_router = APIRouter(dependencies=[Depends(check_origin)])

module_router.include_router(router, prefix="/admin", tags=["Admin Module"])
