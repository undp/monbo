# GEE Forest Change Downloader - User Manual

## Purpose

This script downloads and processes forest change data from two major sources:

- Global Forest Watch (GFW) Hansen dataset
- Tropical Moist Forest (TMF) dataset from JRC

It allows you to extract deforestation data for specific countries and create binary masks showing areas deforested after a specified baseline year.

## Use Cases

### 1. Initial Data Download

- First-time download of deforestation data for specific countries
- Creating baseline deforestation masks for new project areas

### 2. Updates

- Updating existing deforestation maps when new annual data becomes available
- Adding new countries to existing analysis

### 3. Comparison Studies

- Downloading both GFW and TMF data to compare different deforestation datasets
- Creating standardized masks for cross-dataset analysis

## Installation

1. Clone the repository:

```bash
git clone [repository-url]
cd [repository-name]
```

2. Install [uv](https://docs.astral.sh/uv/) (manages the Python environment):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

3. Install dependencies (uv creates and manages the virtual environment automatically):

```bash
uv sync
```

Dependencies are declared in `pyproject.toml` and pinned in `uv.lock`:

```txt
earthengine-api==1.7.45
geemap==0.38.5
tenacity==9.1.4
GDAL>=3.6.0   (see the version-matching note below)
```

The script requires **Python 3.13**, matching `monbo-api`. This floor is
deliberate: `geemap` has required Python >= 3.12 since 0.37.3, and with the
previous `>=3.9` floor uv produced a *forked* lockfile that installed a
different dependency set depending on which interpreter you happened to have —
geemap 0.36.6 on 3.9, 0.37.2 on 3.10–3.11 and 0.38.3 on 3.12+, with numpy
resolving to four different versions across the same range. Since this script
generates the raster files the API reads, that is not acceptable drift. A
single floor gives a single resolution.

> **GDAL version matching.** The `GDAL` Python bindings only build against a
> system `libgdal` of the *same* version — building the 3.13.1 bindings on a
> host with libgdal 3.7.3 fails with
> `Python bindings of GDAL 3.13.1 require at least libgdal 3.13.1`.
> `GDAL` is therefore left as a range rather than an exact pin, and `uv.lock`
> records whatever version resolved at lock time. Before running `uv sync`:
>
> 1. install the system GDAL (`apt-get install gdal-bin libgdal-dev`, or
>    `brew install gdal`), then
> 2. check it with `gdal-config --version`, and
> 3. if it does not match the locked binding, pin the binding to your system
>    version for the install: `uv sync --no-install-package gdal` followed by
>    `uv pip install "GDAL==$(gdal-config --version)"`, or align the system
>    GDAL to the locked version.
>
> The rest of the environment installs and runs independently of GDAL; only
> the VRT/translate step at the end of the pipeline needs it.

4. Set up Google Earth Engine:

- Create a Google Earth Engine account at https://earthengine.google.com/
- On the Earth Engine website, set up your Earth Engine project and get your project ID
- Authenticate your Earth Engine account:

```bash
earthengine authenticate
```

## Configuration

1. Create a `config.py` file by copying `config_example.py`:

```python
CONFIG = {
    "PROJECT_ID": "your-project-id",  # Your Earth Engine project ID
    "COUNTRIES": ["Ecuador", "Colombia"],  # Country names from USDOS/LSIB_SIMPLE/2017
    "ASSET_TYPE": "GFW",  # Options: "gfw" or "tmf"
    "BASELINE_YEAR": 2020  # The year to use as baseline for the deforestation mask
}
```

### Important Configuration Notes:

- `PROJECT_ID`: Your Google Earth Engine project ID
- `COUNTRIES`: Must match exactly with names in USDOS/LSIB_SIMPLE/2017 dataset
- `ASSET_TYPE`: Choose between "GFW" (Global Forest Watch) or "TMF" (Tropical Moist Forest)
- `BASELINE_YEAR`: Year from which to start counting deforestation (inclusive)

## Usage

### Basic Execution

```bash
uv run python run.py
```

### Common Modifications

1. **Adding New Countries**
   Edit `config.py`:

```python
CONFIG = {
    # ... other settings ...
    "COUNTRIES": ["Ecuador", "Colombia", "Peru"],  # Add new countries to the list
    # ... other settings ...
}
```

2. **Switching Datasets**
   Edit `config.py`:

```python
CONFIG = {
    # ... other settings ...
    "ASSET_TYPE": "TMF",  # Change to "GFW" for Global Forest Watch data
    # ... other settings ...
}
```

3. **Changing Baseline Year**
   Edit `config.py`:

```python
CONFIG = {
    # ... other settings ...
    "BASELINE_YEAR": 2020,  # Modify this value to your desired baseline year
    # ... other settings ...
}
```

## Output

The script will generate:

- A GeoTIFF file (`gfw.tif` or `tmf.tif`) containing the deforestation mask
- The output is a binary mask where:
  - 1 = Areas deforested after the baseline year
  - 0/NoData = All other areas

## Processing Details

1. Downloads data in tiles to manage memory
2. Applies LZW compression to reduce file size
3. Automatically cleans up temporary files
4. Includes error handling and retry mechanisms

## Troubleshooting

### 1. Authentication Errors

- Ensure you've run `earthengine authenticate`
- Verify your project ID is correct in `config.py`
- Example error:

```
EEException: Earth Engine authentication is not initialized
```

### 2. Memory Issues

- The script uses tiled downloading to manage memory
- If you encounter memory errors, you can reduce `max_threads` in the code:

```python
class EarthEngineDownloader(ABC):
    def __init__(self, ...):
        # ... other initialization ...
        self.max_threads: int = 5  # Reduce from 10 to 5 or lower
```

### 3. Missing Countries

- Verify country names match exactly with USDOS/LSIB_SIMPLE/2017
- Check the official GEE catalog for correct country names
- Example error:

```
EEException: Collection.filter: No features matched the filter.
```

### 4. Disk Space

- Ensure sufficient free disk space (recommend at least 10GB)
- Temporary files are automatically cleaned up after processing
- Example error:

```
RuntimeError: Insufficient disk space for download
```

## Limitations

- Limited to countries defined in USDOS/LSIB_SIMPLE/2017
- GFW data updated annually
- TMF data specific to tropical regions
- Processing time depends on area size and internet connection

## Best Practices

- Start with small areas when testing
- Keep baseline year consistent across analyses
- Regularly update to latest dataset versions
- Back up final outputs

## Dataset Information

### Global Forest Watch (GFW)

- Source: Hansen/UMD/Google/USGS/NASA
- Resolution: 30m
- Coverage: Global
- Updates: Annual
- Asset ID: `UMD/hansen/global_forest_change_2023_v1_11`

### Tropical Moist Forest (TMF)

- Source: Joint Research Centre (JRC)
- Resolution: 30m
- Coverage: Tropical regions
- Updates: Annual
- Asset ID: `projects/JRC/TMF/v1_2023/DeforestationYear`

## Example Directory Structure

```
your-project/
├── config.py
├── config_example.py
├── pyproject.toml
├── uv.lock
├── run.py
├── .venv/
└── output/
    ├── gfw.tif
    └── tmf.tif
```

## Dependency updates

This script's dependencies are updated by Dependabot (`uv` ecosystem on
`/scripts/update-gfw-tmf`), weekly, with minor and patch updates grouped and majors
isolated. Nothing is automerged. See the root README for the full policy.

Note the interaction with the GDAL version-matching requirement above: Dependabot can
propose a newer `GDAL` binding, but whether that binding *builds* depends on the system
`libgdal` on the machine running `uv sync`. Check `gdal-config --version` before
accepting a GDAL bump.
