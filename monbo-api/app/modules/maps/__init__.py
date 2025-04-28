from app.modules.maps.router import router
from fastapi import APIRouter

module_router = APIRouter()

module_router.include_router(router, prefix="/maps", tags=["Maps Module"])
