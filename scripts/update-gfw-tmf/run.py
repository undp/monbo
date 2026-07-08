from contextlib import contextmanager
import ee
from typing import List
import os
import geemap
import threading
import glob
from osgeo import gdal
import logging
from abc import ABC, abstractmethod
from tenacity import retry, stop_after_attempt, wait_exponential


# Suppress geemap logging
logging.getLogger("geemap").setLevel(logging.ERROR)


class EarthEngineDownloader(ABC):
    def __init__(
        self,
        project_id: str,
        countries_names: List[str],
        output_filename: str,
        asset_id: str,
    ):
        if not project_id or not countries_names or not output_filename or not asset_id:
            raise ValueError("Missing required parameters")
        if not output_filename.endswith(".tif"):
            raise ValueError("Output filename must end with .tif")

        self.project_id: str = project_id
        self.countries_names: List[str] = countries_names
        self.baseline_year: int = None  # to be set by child classes
        self.gee_asset_id: str = asset_id
        self.compression: str = "LZW"
        self.max_threads: int = 10
        self.temp_dir = "temp"
        self.output_dir = "output"
        self.output_filename: str = os.path.join(self.output_dir, output_filename)
        self.countries: ee.FeatureCollection = None  # set later
        self.data: ee.Image = None  # set later
        self.native_scale: float = None  # set from the original asset's native scale
        self.is_projection_geographic: bool = None  # set when projection is detected

        # Initialize logging
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.DEBUG)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

        # Create directories if they don't exist
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)

    def get_download_part_filename(self, i: int):
        return os.path.join(self.temp_dir, f"part_{i}.tif")

    def get_download_part_pattern(self):
        return os.path.join(self.temp_dir, "part_*.tif")

    def authenticate(self):
        """Authenticate and initialize Earth Engine"""
        self.logger.info("Authenticating and initializing Earth Engine")
        try:
            ee.Initialize(project=self.project_id)
            self.logger.info("✅ Done")
        except Exception as e:
            self.logger.error(f"❌ Authentication failed: {str(e)}")
            raise

    def get_countries(self):
        """Get countries from USDOS dataset"""
        country_count = len(self.countries_names)
        self.logger.info(
            f"Getting countries from USDOS dataset for {country_count} countries"
        )
        self.countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(
            ee.Filter.inList("country_na", self.countries_names)
        )
        self.logger.info("✅ Done")

    def get_native_scale(self):
        """Get the native scale (in meters) from the Earth Engine image"""
        if self.data is None:
            raise ValueError("Data must be loaded before getting native scale")

        try:
            proj = self.data.projection()
            proj_info = proj.getInfo()

            # Detect if projection is geographic (degrees) or projected (meters)
            crs = proj_info.get("crs", "")
            if "EPSG:4326" in crs or "geographic" in crs.lower():
                self.is_projection_geographic = True
            else:
                # Check if it's a projected CRS
                # (most common are EPSG:3857, UTM zones, etc.)
                self.is_projection_geographic = False

            scale = proj.nominalScale().getInfo()
            self.native_scale = scale
            crs_type = (
                "geographic (degrees)"
                if self.is_projection_geographic
                else "projected (meters)"
            )
            self.logger.info(f"Detected native scale: {scale} meters")
            self.logger.info(f"Projection CRS: {crs}, Type: {crs_type}")
            return scale
        except Exception as e:
            msg = f"Could not get native scale from EE image: {e}"
            self.logger.warning(msg)
            self.logger.info("Falling back to detecting scale from first tile")
            return None

    def get_scale_from_tile(self, tile_path: str) -> float:
        """Get pixel size in meters from a downloaded tile"""
        import math

        try:
            dataset = gdal.Open(tile_path, gdal.GA_ReadOnly)
            if dataset is None:
                return None

            # Get the CRS (coordinate reference system)
            crs = dataset.GetSpatialRef()
            if crs is None:
                self.logger.warning("No CRS found in tile, assuming geographic")
                is_geographic = True
            else:
                # Check if CRS is geographic (degrees) or projected (meters)
                is_geographic = crs.IsGeographic()

            # Get geotransform
            geotransform = dataset.GetGeoTransform()
            pixel_size_x = abs(geotransform[1])
            pixel_size_y = abs(geotransform[5])

            if is_geographic:
                # Pixel size is in degrees, convert to meters
                # Get center latitude to convert degrees to meters
                center_y = geotransform[3] + (dataset.RasterYSize / 2) * geotransform[5]

                # Convert degrees to meters at this latitude
                lat_rad = math.radians(abs(center_y))
                meters_per_degree_lat = 111320.0
                meters_per_degree_lon = 111320.0 * math.cos(lat_rad)

                # Calculate pixel size in meters
                pixel_size_x_meters = pixel_size_x * meters_per_degree_lon
                pixel_size_y_meters = pixel_size_y * meters_per_degree_lat
                pixel_size_meters = (pixel_size_x_meters + pixel_size_y_meters) / 2.0

                self.logger.info(
                    f"Detected scale from tile: {pixel_size_meters:.2f} meters "
                    f"(pixel size: {pixel_size_x:.8f}° x {pixel_size_y:.8f}°)"
                )
            else:
                # Pixel size is already in meters (projected CRS)
                pixel_size_meters = (pixel_size_x + pixel_size_y) / 2.0

                # Get CRS name for logging
                crs_name = crs.GetName() if crs else "Unknown"
                self.logger.info(
                    f"Detected scale from tile: {pixel_size_meters:.2f} meters "
                    f"(CRS: {crs_name}, "
                    f"pixel size: {pixel_size_x:.2f}m x {pixel_size_y:.2f}m)"
                )

            dataset = None
            return pixel_size_meters
        except Exception as e:
            self.logger.error(f"Error getting scale from tile: {e}")
            return None

    @abstractmethod
    def load_process_and_clip_data(self):
        """
        Load dataset and clip to specified countries.

        To be implemented by child classes.
        """
        pass

    def download_tiles(self):
        """
        Download image in tiles using multiple threads.
        There is no retries, so if the download fails, the function will raise an error.
        """

        self.logger.info("Downloading tiles...")

        # Check available disk space
        free_space = os.statvfs(".").f_frsize * os.statvfs(".").f_bavail
        if free_space < 1e9:  # 1GB minimum
            raise RuntimeError("Insufficient disk space for download")

        # Get the native scale from the Earth Engine image
        if self.native_scale is None:
            raise ValueError("Native scale not detected")

        if self.is_projection_geographic is None:
            raise ValueError("Projection type not detected")

        # Create a grid with the original resolution
        proj = self.data.projection()
        countries_geometry = self.countries.geometry()

        # Log the countries geometry bounds for debugging
        bounds_info = countries_geometry.bounds().getInfo()
        self.logger.info(f"Countries geometry bounds: {bounds_info}")

        # Use fixed tile size in meters (target: ~2400m tiles)
        # This is based on GEE API download limits, not data resolution
        # The native_scale only affects export resolution, not tile size
        tile_size_meters = 2400

        if self.is_projection_geographic:
            # For geographic projections, use a projected CRS (Web Mercator)
            # for grid creation. This avoids issues with coveringGrid in
            # geographic coordinates
            grid_proj = ee.Projection("EPSG:3857")
            grid_tile_size = tile_size_meters  # Web Mercator uses meters

            # Transform countries geometry to Web Mercator for grid creation
            countries_projected = countries_geometry.transform(grid_proj, 1)

            # Create grid in Web Mercator
            grid_projected = countries_projected.coveringGrid(
                grid_proj, scale=grid_tile_size
            )

            # Transform each grid cell back to the data's projection
            def transform_feature(f):
                geom = f.geometry().transform(proj, 1)
                return f.setGeometry(geom)

            grid = grid_projected.map(transform_feature)

            # Filter to only tiles that intersect with the countries geometry
            grid = grid.filterBounds(countries_geometry)

            self.logger.info(
                f"Projection is geographic, using tile_size: {grid_tile_size} meters "
                f"(grid created in Web Mercator, then transformed to data projection)"
            )
        else:
            # Projection is already in meters, use it directly
            tile_size = int(tile_size_meters)
            grid = countries_geometry.coveringGrid(proj, scale=tile_size)
            # Filter to ensure tiles intersect with countries
            grid = grid.filterBounds(countries_geometry)
            self.logger.info(
                f"Projection is projected, using tile_size: {tile_size} meters"
            )

        num_tiles = grid.size().getInfo()
        self.logger.info(f"Total tiles to download: {num_tiles}")
        self.logger.info(f"Using scale: {self.native_scale} meters for export")
        if self.is_projection_geographic:
            self.logger.info(
                f"Tile size: {tile_size_meters:.2f} meters "
                f"(grid created in Web Mercator)"
            )
        else:
            self.logger.info(
                f"Tile size: {tile_size_meters:.2f} meters "
                f"(in projection units: {tile_size})"
            )

        tile_list = grid.toList(num_tiles)

        # Track if we need to detect scale from first tile
        scale_detected_from_tile = False

        # Get countries bounds for validation
        countries_bounds = countries_geometry.bounds().getInfo()
        expected_min_lon = countries_bounds["coordinates"][0][0][0]
        expected_max_lon = countries_bounds["coordinates"][0][2][0]
        expected_min_lat = countries_bounds["coordinates"][0][0][1]
        expected_max_lat = countries_bounds["coordinates"][0][2][1]

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=4, max=10),
            reraise=True,
        )
        def export_tile(i):
            nonlocal scale_detected_from_tile
            try:
                tile = ee.Feature(tile_list.get(i))
                tile_geom = tile.geometry()

                # Log tile geometry for first few tiles for debugging
                if i < 3:
                    tile_bounds = tile_geom.bounds().getInfo()
                    self.logger.info(f"Tile {i} bounds: {tile_bounds}")

                # Use the detected native scale
                export_scale = self.native_scale

                geemap.ee_export_image(
                    self.data,
                    filename=self.get_download_part_filename(i),
                    scale=export_scale,
                    region=tile_geom,
                    file_per_band=False,
                )

                # If this is the first tile, verify the scale and location
                if i == 0 and not scale_detected_from_tile:
                    tile_path = self.get_download_part_filename(i)
                    tile_scale = self.get_scale_from_tile(tile_path)
                    if tile_scale is not None:
                        # Update native_scale if there's a significant difference
                        diff = abs(tile_scale - self.native_scale)
                        if diff > 1.0:  # More than 1 meter difference
                            msg = (
                                f"Scale mismatch: EE reported "
                                f"{self.native_scale:.2f}m, tile has "
                                f"{tile_scale:.2f}m. Using tile scale."
                            )
                            self.logger.warning(msg)
                            self.native_scale = tile_scale
                        scale_detected_from_tile = True

                    # Validate tile location
                    dataset = gdal.Open(tile_path, gdal.GA_ReadOnly)
                    if dataset:
                        geotransform = dataset.GetGeoTransform()
                        tile_lon = geotransform[0]
                        tile_lat = geotransform[3]
                        dataset = None

                        # Check if tile is within expected bounds (with some tolerance)
                        tolerance = 5.0  # degrees
                        lon_min = expected_min_lon - tolerance
                        lon_max = expected_max_lon + tolerance
                        lat_min = expected_min_lat - tolerance
                        lat_max = expected_max_lat + tolerance
                        lon_in_range = lon_min <= tile_lon <= lon_max
                        lat_in_range = lat_min <= tile_lat <= lat_max
                        if not (lon_in_range and lat_in_range):
                            self.logger.warning(
                                f"Tile {i} location ({tile_lon}, {tile_lat}) "
                                f"is outside expected bounds "
                                f"({expected_min_lon}, {expected_min_lat}) to "
                                f"({expected_max_lon}, {expected_max_lat})"
                            )

            except Exception as e:
                self.logger.error(f"Failed to export tile {i}: {str(e)}")
                raise

        return
        # Handle threading
        threads = []
        for i in range(num_tiles):
            thread = threading.Thread(target=export_tile, args=(i,))
            threads.append(thread)
            thread.start()

            if len(threads) >= self.max_threads:
                for t in threads:
                    t.join()
                threads = []

        # Wait for remaining threads
        for t in threads:
            t.join()
        self.logger.info("✅ All exports completed.")

    def merge_and_compress_tiles(self):
        """Merge downloaded tiles into a single compressed GeoTIFF"""

        self.logger.info(f"Merging and compressing tiles into {self.output_filename}")
        try:
            input_files = glob.glob(self.get_download_part_pattern())
            total_input_size = sum(os.path.getsize(f) for f in input_files)
            self.logger.info(
                f"Total size of downloaded files: {total_input_size / 1024**3:.3f}GB"
            )

            if not input_files:
                raise FileNotFoundError("No input tiles found to merge")

            # Build virtual dataset (VRT)
            vrt_path = os.path.join(self.temp_dir, "temp.vrt")
            vrt = gdal.BuildVRT(vrt_path, input_files)
            if vrt is None:
                raise RuntimeError("Failed to build VRT dataset")

            # Create the merged file with compression
            result = gdal.Translate(
                self.output_filename,
                vrt,
                format="GTiff",
                creationOptions=[f"COMPRESS={self.compression}"],
            )
            if result is None:
                raise RuntimeError("Failed to create output file")

            # Get and log the final file size
            final_size = os.path.getsize(self.output_filename)
            self.logger.info(
                f"Final compressed file size: {final_size / 1024**3:.3f}GB"
            )
            compression_ratio = total_input_size / final_size
            self.logger.info(f"Compression ratio: {compression_ratio:.3f}x")
            self.logger.info("✅ Done")
        finally:
            vrt = None
            if os.path.exists(vrt_path):
                os.remove(vrt_path)

    def cleanup_tiles(self):
        """Delete all temporary tile files and the temporary folder"""
        pattern = self.get_download_part_pattern()
        self.logger.info(f"Cleaning up tiles with pattern: {pattern}")
        tile_files = glob.glob(pattern)
        if not tile_files:
            raise FileNotFoundError("No tiles found to clean up")
        for file in tile_files:
            os.remove(file)
        # Remove the empty directory
        os.rmdir(self.temp_dir)
        self.logger.info("✅ Done")

    @contextmanager
    def download_session(self):
        """Context manager to ensure cleanup of temporary files"""
        try:
            yield self
        finally:
            try:
                # self.cleanup_tiles()
                pass
            except FileNotFoundError:
                self.logger.warning("No temporary files found to clean up")
            except Exception as e:
                self.logger.error(f"Error during cleanup: {e}")

    def run(self):
        """Execute the full download pipeline"""
        self.authenticate()
        self.get_countries()
        self.load_process_and_clip_data()
        # Add to both scripts before downloading:
        print(
            "Data info:", self.data.getInfo()
        )  # or data.getInfo() in download_gfw1.py
        print("Projection:", self.data.projection().getInfo())
        print("Scale:", self.data.projection().nominalScale().getInfo())
        with self.download_session():
            self.download_tiles()
            self.merge_and_compress_tiles()


class GFWDownloader(EarthEngineDownloader):
    def __init__(
        self,
        project_id: str,
        countries_names: List[str],
        output_filename: str,
        asset_id: str,
    ):
        super().__init__(project_id, countries_names, output_filename, asset_id)
        self.baseline_year: int = (
            20  # The year in GFW is representes as 20, 21, 22, etc.
        )

    def load_process_and_clip_data(self):
        """Load GFW dataset and clip to specified countries"""
        self.logger.info(f"Loading GFW dataset from: {self.gee_asset_id}")
        gfw_deforestation = ee.Image(self.gee_asset_id)
        self.data = gfw_deforestation.select("lossyear")

        self.logger.info(
            f"Binarizing deforestation for baseline year: {self.baseline_year}"
        )
        self.data = self.data.gt(self.baseline_year).selfMask()

        self.logger.info(f"Clipping to countries: {self.countries_names}")
        self.data = self.data.clip(self.countries)

        # Get native scale after data is loaded
        self.get_native_scale()

        self.logger.info("✅ Done")


class TMFDownloader(EarthEngineDownloader):
    def __init__(
        self,
        project_id: str,
        countries_names: List[str],
        output_filename: str,
        asset_id: str,
    ):
        super().__init__(project_id, countries_names, output_filename, asset_id)
        self.baseline_year: int = 2020

    def load_process_and_clip_data(self):
        """Load TMF dataset, process and clip to specified countries"""
        self.logger.info(f"Loading TMF dataset from: {self.gee_asset_id}")
        tmf_data = ee.ImageCollection(self.gee_asset_id)
        self.data = tmf_data.mosaic()

        self.logger.info(
            f"Binarizing deforestation for baseline year: {self.baseline_year}"
        )
        self.data = self.data.gt(self.baseline_year).selfMask()

        self.logger.info(f"Clipping to countries: {self.countries_names}")
        self.data = self.data.clip(self.countries)

        # Get native scale after data is loaded
        self.get_native_scale()

        self.logger.info("✅ Done")


def main():
    try:
        from config import CONFIG
    except ImportError:
        raise ImportError(
            "Please create a config.py file with your settings. "
            "See config_example.py for reference."
        )

    if CONFIG["EXECUTE_FOR"] == "GFW":
        gfw_downloader = GFWDownloader(
            project_id=CONFIG["PROJECT_ID"],
            countries_names=CONFIG["COUNTRIES"],
            output_filename="gfw.tif",
            asset_id=CONFIG["GFW_ASSET_ID"],
        )
        gfw_downloader.run()

    elif CONFIG["EXECUTE_FOR"] == "TMF":
        tmf_downloader = TMFDownloader(
            project_id=CONFIG["PROJECT_ID"],
            countries_names=CONFIG["COUNTRIES"],
            output_filename="tmf.tif",
            asset_id=CONFIG["TMF_ASSET_ID"],
        )
        tmf_downloader.run()
    else:
        raise ValueError(
            f"Invalid execution for: '{CONFIG['EXECUTE_FOR']}'. Must be 'GFW' or 'TMF'"
        )


if __name__ == "__main__":
    main()
