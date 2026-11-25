from fastapi import APIRouter

from app.modules.usage.router import router

module_router = APIRouter()

module_router.include_router(router, prefix="/events", tags=["Usage Module"])
