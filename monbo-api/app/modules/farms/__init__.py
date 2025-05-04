from app.modules.farms.router import router
from fastapi import APIRouter

module_router = APIRouter()

module_router.include_router(router, prefix="/farms", tags=["Farms Module"])
