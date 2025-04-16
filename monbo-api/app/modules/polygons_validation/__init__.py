from app.modules.polygons_validation.router import router
from fastapi import APIRouter

module_router = APIRouter()

module_router.include_router(
    router, prefix="/polygons_validation", tags=["Polygons Validation Module"]
)
