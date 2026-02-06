# Background Removal Setup

This directory contains the Python script for background removal using **rembg** (free, open-source).

## Prerequisites

1. **Python 3.8 or higher** must be installed on your system
   - Windows: Download from [python.org](https://www.python.org/downloads/)
   - Mac: `brew install python3`
   - Linux: `sudo apt install python3 python3-pip`

## Installation

1. **Install Python dependencies:**

   ```bash
   cd scripts
   pip install -r requirements.txt
   ```

   Or if you're using `pip3`:

   ```bash
   pip3 install -r requirements.txt
   ```

2. **Verify installation:**

   Test the background removal script:

   ```bash
   python remove_bg.py test_input.jpg test_output.png
   ```

## How It Works

- The Node.js backend calls the Python script via `child_process`
- The Python script uses the `rembg` library (U²-Net model) to remove backgrounds
- Processed images are saved with a `_nobg` suffix
- **Completely free** - no API keys or usage limits

## Configuration

In your `.env` file:

```env
# Use 'python' on Windows, 'python3' on Linux/Mac
PYTHON_CMD=python
```

## Troubleshooting

### "Python not found" error
- Make sure Python is installed and added to your PATH
- Try changing `PYTHON_CMD=python` to `PYTHON_CMD=python3` in `.env`

### "ModuleNotFoundError: No module named 'rembg'"
- Run: `pip install -r requirements.txt`

### Slow first run
- The first background removal downloads the AI model (~176MB)
- Subsequent runs are much faster

## Performance

- First run: ~10-30 seconds (downloads model)
- Subsequent runs: ~2-5 seconds per image
- Runs locally - no internet required after model download
