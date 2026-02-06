"""
Background removal script using rembg (open-source, free)
Usage: python remove_bg.py <input_path> <output_path>
"""

import sys
from rembg import remove
from PIL import Image

def remove_background(input_path, output_path):
    """Remove background from image using rembg"""
    try:
        # Open input image
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()

        # Remove background
        output_data = remove(input_data)

        # Save output image
        with open(output_path, 'wb') as output_file:
            output_file.write(output_data)

        print(f"SUCCESS: Background removed and saved to {output_path}")
        return 0

    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python remove_bg.py <input_path> <output_path>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    exit_code = remove_background(input_path, output_path)
    sys.exit(exit_code)
