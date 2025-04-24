from typing import Callable, Tuple
from PIL import Image, ImageDraw
from app.utils.image_generation.constants import MapStyles, MapDefaults


class ImageManipulationHelper:
    """Helper class for manipulating images."""

    @staticmethod
    def combine_image_layers(*layers: Image.Image) -> Image.Image:
        """
        Combine multiple image layers using alpha compositing from bottom to top.

        Args:
            *layers: Any number of PIL Image objects in bottom-to-top order.
                The first image will be converted to RGBA mode if needed.
                All subsequent images must already be in RGBA mode.

        Returns:
            A single combined PIL Image in RGBA mode

        Raises:
            ValueError: If no layers are provided
        """
        if not layers:
            raise ValueError("At least one image layer is required")

        # Start with the bottom layer, ensuring it's in RGBA mode
        result = layers[0].convert("RGBA")

        # Composite each subsequent layer on top
        for layer in layers[1:]:
            result = Image.alpha_composite(result, layer)

        return result

    @staticmethod
    def create_anti_aliased_overlay(
        output_size: Tuple[int, int],
        draw_func: Callable[[Image.Image, ImageDraw.Draw, float], None],
    ) -> Image.Image:
        """
        Creates an anti-aliased overlay by drawing at higher resolution and
        downsampling.

        Args:
            output_size: Tuple of (width, height) in pixels for the final output image
            draw_func: Function that takes (image, draw, scale_factor) parameters and
                performs the actual drawing operations. The image parameter is the PIL
                Image to draw on, draw is the ImageDraw object, and scale_factor is
                the multiplier used for the higher resolution drawing.

        Returns:
            PIL Image with the anti-aliased overlay in RGBA mode, resized to the
            specified output_size
        """
        # Create a larger image for smoother lines/shapes
        large_size = (
            output_size[0] * MapStyles.SCALE_FACTOR,
            output_size[1] * MapStyles.SCALE_FACTOR,
        )
        smooth_overlay = Image.new("RGBA", large_size, (0, 0, 0, 0))
        smooth_draw = ImageDraw.Draw(smooth_overlay)

        # Call the provided drawing function
        draw_func(smooth_overlay, smooth_draw, MapStyles.SCALE_FACTOR)

        # Resize back down with anti-aliasing
        return smooth_overlay.resize(output_size, MapDefaults.RASTER_RESAMPLING)
