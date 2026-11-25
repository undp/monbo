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
logging.getLogger('geemap').setLevel(logging.ERROR)


class EarthEngineDownloader(ABC):
    def __init__(self, project_id: str, countries_names: List[str], output_filename: str,
                 asset_id: str):
        if not project_id or not countries_names or not output_filename or not asset_id:
            raise ValueError("Missing required parameters")
        if not output_filename.endswith('.tif'):
            raise ValueError("Output filename must end with .tif")

        self.project_id: str = project_id
        self.countries_names: List[str] = countries_names
        self.baseline_year: int = None  # to be set by child classes
        self.gee_asset_id: str = asset_id
        self.compression: str = "LZW"
        self.max_threads: int = 10
        self.grid_scale: int = 30  # Could be modified depending on the dataset
        self.temp_dir = "temp"
        self.output_dir = "output"
        self.output_filename: str = os.path.join(self.output_dir, output_filename)
        self.countries: ee.FeatureCollection = None  # to be set when calling get_countries()
        self.data: ee.Image = None  # to be set when calling load_and_clip_data()

        # Initialize logging
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
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
        self.logger.info(f"Getting countries from USDOS dataset for {len(self.countries_names)} countries")
        self.countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(
            ee.Filter.inList("country_na", self.countries_names)
        )
        self.logger.info("✅ Done")

    @abstractmethod
    def load_process_and_clip_data(self):
        """Load dataset and clip to specified countries - to be implemented by child classes"""
        pass

    def download_tiles(self):
        """
        Download image in tiles using multiple threads.
        There is no retries, so if the download fails, the function will raise an error.
        """

        self.logger.info("Downloading tiles...")

        # Check available disk space
        free_space = os.statvfs('.').f_frsize * os.statvfs('.').f_bavail
        if free_space < 1e9:  # 1GB minimum
            raise RuntimeError("Insufficient disk space for download")

        # Create a grid of like 32768x32768 pixels with the original resolution (~30m)
        proj = self.data.projection()
        tile_size = int(2400 * self.grid_scale)  # Size of each fragment in meters

        grid = self.countries.geometry().coveringGrid(proj, scale=tile_size)
        num_tiles = grid.size().getInfo()
        self.logger.info(f"Total tiles to download: {num_tiles}")

        tile_list = grid.toList(num_tiles)

        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=4, max=10),
            reraise=True
        )
        def export_tile(i):
            try:
                tile = ee.Feature(tile_list.get(i))

                geemap.ee_export_image(
                    self.data,
                    filename=self.get_download_part_filename(i),
                    scale=30,
                    region=tile.geometry(),
                    file_per_band=False,
                )
            except Exception as e:
                self.logger.error(f"Failed to export tile {i}: {str(e)}")
                raise

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
            self.logger.info(f"Total size of downloaded files: {total_input_size / 1024**3:.3f}GB")

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
            self.logger.info(f"Final compressed file size: {final_size / 1024**3:.3f}GB")
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
                self.cleanup_tiles()
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
        print("Data info:", self.data.getInfo())  # or data.getInfo() in download_gfw1.py
        print("Projection:", self.data.projection().getInfo())
        print("Scale:", self.data.projection().nominalScale().getInfo())
        with self.download_session():
            self.download_tiles()
            self.merge_and_compress_tiles()


class GFWDownloader(EarthEngineDownloader):
    def __init__(self, project_id: str, countries_names: List[str], output_filename: str,
                 asset_id: str):
        super().__init__(project_id, countries_names, output_filename, asset_id)
        self.baseline_year: int = 20  # The year in GFW is representes as 20, 21, 22, etc.

    def load_process_and_clip_data(self):
        """Load GFW dataset and clip to specified countries"""
        self.logger.info(f"Loading GFW dataset from: {self.gee_asset_id}")
        gfw_deforestation = ee.Image(self.gee_asset_id)
        self.data = gfw_deforestation.select("lossyear")

        self.logger.info(f"Binarizing deforestation for baseline year: {self.baseline_year}")
        self.data = self.data.gt(self.baseline_year).selfMask()

        self.logger.info(f"Clipping to countries: {self.countries_names}")
        self.data = self.data.clip(self.countries)
        self.logger.info("✅ Done")


class TMFDownloader(EarthEngineDownloader):
    def __init__(self, project_id: str, countries_names: List[str], output_filename: str,
                 asset_id: str):
        super().__init__(project_id, countries_names, output_filename, asset_id)
        self.baseline_year: int = 2020

    def load_process_and_clip_data(self):
        """Load TMF dataset, process and clip to specified countries"""
        self.logger.info(f"Loading TMF dataset from: {self.gee_asset_id}")
        tmf_data = ee.ImageCollection(self.gee_asset_id)
        self.data = tmf_data.mosaic()

        self.logger.info(f"Binarizing deforestation for baseline year: {self.baseline_year}")
        self.data = self.data.gt(self.baseline_year).selfMask()

        self.logger.info(f"Clipping to countries: {self.countries_names}")
        self.data = self.data.clip(self.countries)
        self.logger.info("✅ Done")


def main():
    try:
        from config import CONFIG
    except ImportError:
        raise ImportError("Please create a config.py file with your settings. See config_example.py for reference.")

    if CONFIG["EXECUTE_FOR"] == "GFW":
        gfw_downloader = GFWDownloader(
            project_id=CONFIG["PROJECT_ID"],
            countries_names=CONFIG["COUNTRIES"],
            output_filename="gfw.tif",
            asset_id=CONFIG["GFW_ASSET_ID"]
        )
        gfw_downloader.run()

    elif CONFIG["EXECUTE_FOR"] == "TMF":
        tmf_downloader = TMFDownloader(
            project_id=CONFIG["PROJECT_ID"],
            countries_names=CONFIG["COUNTRIES"],
            output_filename="tmf.tif",
            asset_id=CONFIG["TMF_ASSET_ID"]
        )
        tmf_downloader.run()
    else:
        raise ValueError(f"Invalid execution for: '{CONFIG['EXECUTE_FOR']}'. Must be 'GFW' or 'TMF'")


if __name__ == "__main__":
    main()
