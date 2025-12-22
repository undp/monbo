from osgeo import gdal
from osgeo import osr  # Add this import


def print_raster_attributes(raster_path: str, label: str = "Output Raster"):
    """Print geospatial attributes of a GDAL raster file"""
    print(f"\n{'='*60}")
    print(f"Geospatial Attributes: {label}")
    print(f"{'='*60}")

    try:
        dataset = gdal.Open(raster_path, gdal.GA_ReadOnly)
        if dataset is None:
            print(f"Could not open raster: {raster_path}")
            return

        # Get geotransform
        geotransform = dataset.GetGeoTransform()
        # Format: (x_origin, x_pixel_size, x_rotation, y_origin, y_rotation, y_pixel_size)
        x_origin = geotransform[0]
        y_origin = geotransform[3]
        x_pixel_size = geotransform[1]
        y_pixel_size = abs(geotransform[5])  # Usually negative for north-up images

        # Get projection
        proj = dataset.GetProjection()
        srs = osr.SpatialReference()
        srs.ImportFromWkt(proj)
        crs = (
            srs.GetAttrValue("AUTHORITY", 1)
            if srs.GetAttrValue("AUTHORITY", 0) == "EPSG"
            else proj
        )

        # Get dimensions
        width = dataset.RasterXSize
        height = dataset.RasterYSize

        # Calculate extent
        min_x = x_origin
        max_x = x_origin + width * x_pixel_size
        max_y = y_origin
        min_y = y_origin - height * y_pixel_size  # y_pixel_size is usually negative

        print(f"File: {raster_path}")
        print(f"CRS: {crs}")
        print(f"Dimensions (Width x Height): {width} x {height}")
        print(f"Origin (X, Y): ({x_origin}, {y_origin})")
        print(f"Pixel Size (X, Y): ({x_pixel_size}, {y_pixel_size})")
        print(f"Extent:")
        print(f"  Min X (Lon): {min_x}")
        print(f"  Max X (Lon): {max_x}")
        print(f"  Min Y (Lat): {min_y}")
        print(f"  Max Y (Lat): {max_y}")
        print(f"  Size: ({max_x - min_x}°, {max_y - min_y}°)")

        dataset = None

    except Exception as e:
        print(f"Error getting raster attributes: {e}")

    print(f"{'='*60}\n")


if __name__ == "__main__":
    print_raster_attributes("output/gfw_merged.tif")
    print_raster_attributes("output/Hansen_GFC-2024-v1.12_lossyear_10N_090W.tif")
    print_raster_attributes("temp/part_0.tif")
    print_raster_attributes("output/gfw.tif")
