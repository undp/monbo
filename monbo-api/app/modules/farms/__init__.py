from fastapi import APIRouter

from app.modules.farms.router import router

module_router = APIRouter()

module_router.include_router(router, prefix="/farms", tags=["Farms Module"])
