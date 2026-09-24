from fastapi import APIRouter

from app.modules.maps.router import router

module_router = APIRouter()

module_router.include_router(router, prefix="/maps", tags=["Maps Module"])
