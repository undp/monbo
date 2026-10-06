from fastapi import APIRouter

from app.modules.maps.countries import router as countries_router
from app.modules.maps.router import router

module_router = APIRouter()

module_router.include_router(router, prefix="/maps", tags=["Maps Module"])
module_router.include_router(
    countries_router, prefix="/countries", tags=["Maps Module"]
)
