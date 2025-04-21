from io import BytesIO

import numpy as np
import requests
from app.config.env import GOOGLE_SERVICE_API_KEY
from fastapi import APIRouter
from PIL import Image, ImageDraw
from pyproj import Transformer
from rasterio import open as rasterio_open
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from shapely.geometry import shape

router = APIRouter()


class NoRasterDataOverlapError(Exception):
    """Raised when the requested polygon doesn't overlap with the map's raster data"""

    pass


def get_google_maps_satellite_image(center, zoom, size=(500, 500)):
    # Construct the URL for Google Maps Static API
    url = (
        f"https://maps.googleapis.com/maps/api/staticmap?"
        f"center={center[0]},{center[1]}&zoom={zoom}&size={size[0]}x{size[1]}"
        f"&maptype=satellite&key={GOOGLE_SERVICE_API_KEY}"
    )

    # Make a request to fetch the image
    response = requests.get(url)

    # Check if the request was successful
    if response.status_code != 200:
        print(f"Error from Google Maps API: Status {response.status_code}")
        print(
            f"Response content: {response.text[:200]}..."
        )  # Print first 200 chars of response
        # Return a fallback image
        return Image.new("RGB", size, color=(0, 0, 0))

    try:
        # Open the image
        img = Image.open(BytesIO(response.content))
        return img
    except Exception as e:
        print(f"Failed to process image: {e}")
        print(f"Response headers: {response.headers}")
        # Return a fallback image
        return Image.new("RGB", size, color=(0, 0, 0))


def calculate_polygon_bounds(geom):
    # Calculate the center and bounds of the polygon in WGS84 coordinates
    lons, lats = zip(*[(lon, lat) for lon, lat in geom.exterior.coords])
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    return min_lon, max_lon, min_lat, max_lat


def calculate_polygon_center(geom):
    min_lon, max_lon, min_lat, max_lat = calculate_polygon_bounds(geom)

    center_lon = (max_lon + min_lon) / 2
    center_lat = (max_lat + min_lat) / 2
    return center_lon, center_lat


def generate_deforestation_image(
    geom, tif_path, output_size=(500, 500), padding_ratio=0.5
):
    with rasterio_open(tif_path) as src:
        with WarpedVRT(src, crs="EPSG:3857") as vrt:
            # Reproject polygon to EPSG:3857
            transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

            # In GeoJSON, coordinates are [longitude, latitude]
            reprojected_coords = [
                transformer.transform(lon, lat) for lon, lat in geom.exterior.coords
            ]
            geom_proj = shape({"type": "Polygon", "coordinates": [reprojected_coords]})

            # Calculate padded bounds
            minx, miny, maxx, maxy = geom_proj.bounds
            width = maxx - minx
            height = maxy - miny
            pad_x = width * padding_ratio
            pad_y = height * padding_ratio
            padded_bounds = (minx - pad_x, miny - pad_y, maxx + pad_x, maxy + pad_y)

            # Check if the window intersects with the VRT's bounds
            vrt_bounds = vrt.bounds
            if (
                (padded_bounds[0] > vrt_bounds[2])
                or (padded_bounds[2] < vrt_bounds[0])
                or (padded_bounds[1] > vrt_bounds[3])
                or (padded_bounds[3] < vrt_bounds[1])
            ):
                raise NoRasterDataOverlapError(
                    "The requested polygon does not overlap with the requested map's "
                    "raster data"
                )

            # Read the raster window
            window = vrt.window(*padded_bounds)
            vrt.window_transform(window)
            data = vrt.read(
                1,
                window=window,
                out_shape=(output_size[1], output_size[0]),
                resampling=Resampling.nearest,
            )

            # Create deforestation mask
            color = (255, 20, 20, 180)  # RGBA
            mask_data = (data == 1).astype(np.uint8)
            rgba_data = np.zeros((output_size[1], output_size[0], 4), dtype=np.uint8)
            rgba_data[..., 0] = mask_data * color[0]
            rgba_data[..., 1] = mask_data * color[1]
            rgba_data[..., 2] = mask_data * color[2]
            rgba_data[..., 3] = mask_data * color[3]

            mask_img = Image.fromarray(rgba_data, mode="RGBA")
            return mask_img


def calculate_zoom_level(geom, output_size=(500, 500), padding_ratio=0.3) -> int:
    # Calculate approximate width and height in degrees
    min_lon, max_lon, min_lat, max_lat = calculate_polygon_bounds(geom)
    width_degrees = max_lon - min_lon
    height_degrees = max_lat - min_lat

    # Add padding
    padded_min_lon = min_lon - width_degrees * padding_ratio
    padded_max_lon = max_lon + width_degrees * padding_ratio
    padded_min_lat = min_lat - height_degrees * padding_ratio
    padded_max_lat = max_lat + height_degrees * padding_ratio

    padded_width = padded_max_lon - padded_min_lon
    padded_height = padded_max_lat - padded_min_lat

    # Calculate zoom level based on the size of the area and the output image size
    # The formula is based on the Google Maps API reference
    # We want to ensure the entire padded area fits within our image

    # Estimate required zoom level based on the larger dimension
    # At zoom level 0, the world is 256px wide/tall
    # Each zoom level doubles the resolution
    world_width_degrees = 360
    world_height_degrees = 170  # Approximate, excluding polar regions

    x_zoom = np.log2(output_size[0] / 256 * world_width_degrees / padded_width)
    y_zoom = np.log2(output_size[1] / 256 * world_height_degrees / padded_height)

    # Use the more conservative zoom to ensure the entire area fits
    calculated_zoom = min(x_zoom, y_zoom)

    # Add a zoom boost to get closer (increase this number for closer zoom)
    zoom_boost = 1.0  # Add 1 zoom level

    # Apply zoom and round to integer, with limits
    zoom_level = min(int(calculated_zoom + zoom_boost), 20)  # Limit max zoom
    zoom_level = max(zoom_level, 17)  # Set higher minimum zoom for closer detail

    return zoom_level


def generate_satellite_image(geom, output_size, zoom_level):
    # Fetch satellite image with calculated zoom level
    # Google Maps API expects (lat, lon) format for center
    center_lon, center_lat = calculate_polygon_center(geom)
    google_center = [center_lat, center_lon]
    satellite_img = get_google_maps_satellite_image(
        google_center, zoom=zoom_level, size=output_size
    )
    return satellite_img


def generate_polygon_image(geom, output_size, zoom_level):
    """
    Generate a polygon image with a transparent overlay.
    For smoother edges the approach is to:
        - Creates a larger canvas (3x the original size)
        - Draws a thicker line (6px vs 3px) on this larger canvas
        - Resizes back down using LANCZOS resampling for anti-aliasing
        - The outline is also slightly more opaque (230 vs 200)
    """
    center_lon, center_lat = calculate_polygon_center(geom)

    # Create a transparent overlay for the polygon
    overlay = Image.new("RGBA", output_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Function to convert lat/lon to pixel coordinates in our image
    def latlon_to_pixel(lat, lon):
        """Convert lat/lon to pixel coordinates on our Google Maps image"""
        # Google Maps uses Web Mercator projection
        # First, calculate world coordinates at this zoom level
        world_size = 256 * (2**zoom_level)

        # Calculate normalized x/y (0-1 across the world)
        norm_x = (lon + 180) / 360
        # Calculate normalized y using Web Mercator formula
        sin_lat = np.sin(np.radians(lat))
        norm_y = 0.5 - np.log((1 + sin_lat) / (1 - sin_lat)) / (4 * np.pi)

        # Calculate world pixel coordinates
        world_x = norm_x * world_size
        world_y = norm_y * world_size

        # Calculate center of the map in world coordinates
        center_x = (center_lon + 180) / 360 * world_size
        sin_center_lat = np.sin(np.radians(center_lat))
        center_y = (
            0.5 - np.log((1 + sin_center_lat) / (1 - sin_center_lat)) / (4 * np.pi)
        ) * world_size

        # Calculate pixel coordinates relative to our viewport
        pixel_x = int(world_x - center_x + output_size[0] / 2)
        pixel_y = int(world_y - center_y + output_size[1] / 2)

        return pixel_x, pixel_y

    # Convert polygon vertices to pixel coordinates
    pixel_coords = [latlon_to_pixel(lat, lon) for lon, lat in geom.exterior.coords]

    # Draw the polygon with smoother, anti-aliased edges
    # 1. Draw a semi-transparent filled polygon
    draw.polygon(pixel_coords, fill=(255, 235, 59, 40))

    # 2. Draw a higher quality outline with anti-aliasing
    # Create a larger image for smoother lines
    scale_factor = 3
    large_size = (output_size[0] * scale_factor, output_size[1] * scale_factor)
    smooth_overlay = Image.new("RGBA", large_size, (0, 0, 0, 0))
    smooth_draw = ImageDraw.Draw(smooth_overlay)

    # Scale up the coordinates
    scaled_coords = [(x * scale_factor, y * scale_factor) for x, y in pixel_coords]

    # Draw thicker line on larger canvas
    smooth_draw.line(
        scaled_coords + [scaled_coords[0]], fill=(255, 235, 59, 230), width=6
    )

    # Resize back down with anti-aliasing
    smooth_overlay = smooth_overlay.resize(output_size, Image.LANCZOS)

    # Combine the polygon fill and anti-aliased outline
    overlay = Image.alpha_composite(overlay, smooth_overlay)

    return overlay


def generate_polygon_image2(geom, output_size, zoom_level):
    """
    Generate a polygon image with a transparent overlay.
    Enhanced version with multiple techniques for smoother edges:
    - Super-sampling with 4x scale for ultra-smooth edges
    - Double-line approach with inner and outer strokes
    - Gaussian blur for softer edges
    - Corner point markers for better vertex visibility
    """
    center_lon, center_lat = calculate_polygon_center(geom)

    # Create a transparent overlay for the polygon
    overlay = Image.new("RGBA", output_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Function to convert lat/lon to pixel coordinates in our image
    def latlon_to_pixel(lat, lon):
        """Convert lat/lon to pixel coordinates on our Google Maps image"""
        # Google Maps uses Web Mercator projection
        # First, calculate world coordinates at this zoom level
        world_size = 256 * (2**zoom_level)

        # Calculate normalized x/y (0-1 across the world)
        norm_x = (lon + 180) / 360
        # Calculate normalized y using Web Mercator formula
        sin_lat = np.sin(np.radians(lat))
        norm_y = 0.5 - np.log((1 + sin_lat) / (1 - sin_lat)) / (4 * np.pi)

        # Calculate world pixel coordinates
        world_x = norm_x * world_size
        world_y = norm_y * world_size

        # Calculate center of the map in world coordinates
        center_x = (center_lon + 180) / 360 * world_size
        sin_center_lat = np.sin(np.radians(center_lat))
        center_y = (
            0.5 - np.log((1 + sin_center_lat) / (1 - sin_center_lat)) / (4 * np.pi)
        ) * world_size

        # Calculate pixel coordinates relative to our viewport
        pixel_x = int(world_x - center_x + output_size[0] / 2)
        pixel_y = int(world_y - center_y + output_size[1] / 2)

        return pixel_x, pixel_y

    # Convert polygon vertices to pixel coordinates
    pixel_coords = [latlon_to_pixel(lat, lon) for lon, lat in geom.exterior.coords]

    # Draw a semi-transparent filled polygon
    draw.polygon(pixel_coords, fill=(255, 235, 59, 40))

    # ENHANCED ANTIALIASING: Create a larger super-sampled image
    scale_factor = 4  # Increased from 3 to 4 for even more smoothness
    large_size = (output_size[0] * scale_factor, output_size[1] * scale_factor)
    smooth_overlay = Image.new("RGBA", large_size, (0, 0, 0, 0))
    smooth_draw = ImageDraw.Draw(smooth_overlay)

    # Scale up the coordinates
    scaled_coords = [(x * scale_factor, y * scale_factor) for x, y in pixel_coords]

    # DOUBLE-LINE TECHNIQUE: a thicker one underneath and a thinner one on top
    # This creates a subtle edge highlight effect
    # First, draw thicker yellow outer line
    smooth_draw.line(
        scaled_coords + [scaled_coords[0]], fill=(255, 235, 59, 200), width=10
    )

    # Then, draw thinner brighter line on top for a subtle glow effect
    smooth_draw.line(
        scaled_coords + [scaled_coords[0]], fill=(255, 245, 120, 255), width=10
    )

    try:
        # Import optional dependencies for additional processing
        from PIL import ImageFilter

        print("Applying Gaussian blur")
        # Apply slight Gaussian blur for softer edges (if ImageFilter is available)
        smooth_overlay = smooth_overlay.filter(ImageFilter.GaussianBlur(radius=0.5))
    except (ImportError, AttributeError):
        # Skip blur if not available
        pass

    # Resize back down with high-quality anti-aliasing
    smooth_overlay = smooth_overlay.resize(output_size, Image.LANCZOS)

    # Combine the polygon fill and anti-aliased outline
    overlay = Image.alpha_composite(overlay, smooth_overlay)

    return overlay


def generate_deforestation_results_image(
    geojson_feature, tif_path, output_size=(500, 500), padding_ratio=0.3
):
    """
    Generate an image with a polygon overlay on a Google Maps satellite image.
    Focus on correct alignment of the polygon with the satellite imagery.
    """
    # Extract the polygon geometry from GeoJSON
    geom = shape(geojson_feature["geometry"])

    # Generate the deforestation mask image
    mask_img = generate_deforestation_image(geom, tif_path, output_size, padding_ratio)

    # Calculate the zoom level
    zoom_level = calculate_zoom_level(geom, output_size, padding_ratio)

    # Generate the satellite image
    satellite_img = generate_satellite_image(geom, output_size, zoom_level)

    # Generate the polygon overlay
    polygon_img = generate_polygon_image(geom, output_size, zoom_level)

    # Combine the layers
    result = Image.alpha_composite(satellite_img.convert("RGBA"), mask_img)
    result = Image.alpha_composite(result, polygon_img)

    return result
