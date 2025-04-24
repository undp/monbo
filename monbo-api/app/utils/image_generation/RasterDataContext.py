from types import TracebackType
from typing import Optional, Type
from rasterio import open as rasterio_open
from rasterio.vrt import WarpedVRT
import asyncio


class RasterDataContext:
    """
    Context manager for handling raster data operations.

    Provides safe handling of raster file resources by automatically closing
    file handles when exiting the context.

    Args:
        tif_path: Path to the TIFF file to open
        target_crs: Target coordinate reference system. Defaults to Web Mercator
            projection (EPSG:3857)
    """

    def __init__(self, tif_path: str, target_crs: str = "EPSG:3857"):
        self.tif_path = tif_path
        self.target_crs = target_crs
        self.src = None
        self.vrt = None

    async def __aenter__(self):
        """
        Opens the raster file and creates a virtual warped copy in the target CRS.

        Returns:
            WarpedVRT: Virtual warped raster dataset in the target CRS
        """
        self.src = await asyncio.to_thread(rasterio_open, self.tif_path)
        self.vrt = await asyncio.to_thread(WarpedVRT, self.src, crs=self.target_crs)
        return self.vrt

    async def __aexit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ):
        """
        Closes all open file handles when exiting the context.

        Args:
            exc_type: Type of exception that occurred, if any
            exc_val: Exception instance that occurred, if any
            exc_tb: Traceback of exception that occurred, if any
        """
        if self.vrt:
            await asyncio.to_thread(self.vrt.close)
        if self.src:
            await asyncio.to_thread(self.src.close)
