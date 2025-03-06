# Utility Scripts

This directory contains utility scripts for managing the Kaspixel application.

## Place KASPA Direct Script

The `place_kaspa_direct.py` script allows you to place "KASPA" directly on the canvas from within the backend container, bypassing the payment requirement. This script is designed to be run only from within the backend container for security reasons.

### Usage

To run the script, you need to execute it from within the backend container:

```bash
# Connect to the backend container
docker exec -it backend /bin/bash

# Navigate to the utils directory
cd app/utils

# Run the script with default settings (Kaspa brand color #70C7BA, 10x scale)
python place_kaspa_direct.py

# Or specify a custom color
python place_kaspa_direct.py --color "#FF0000"

# Or specify a custom wallet address
python place_kaspa_direct.py --wallet "your-wallet-address"

# Or specify a custom scale factor (default is 10)
python place_kaspa_direct.py --scale 15

# Or combine multiple options
python place_kaspa_direct.py --color "#FF0000" --scale 8 --wallet "your-wallet-address"
```

### Scale Factor

The `--scale` parameter controls the size of the "KASPA" text:
- Default value is 10 (10x the original size)
- Higher values create larger text
- Each letter is scaled by creating blocks of pixels for each original pixel
- The letter patterns have been redesigned to be much thicker and more visible

### Security

This script can only be run from within the container. It checks for the presence of the `/.dockerenv` file, which is automatically created by Docker in all containers. If this file is not found, the script will exit with an error message.

### Functionality

When run, the script will:

1. Calculate the center of the canvas
2. Place pixels to form "KASPA" across the center at the specified scale
3. Directly insert the pixels into the database
4. Broadcast updates to all connected clients
5. Print the number of pixels that were placed

### Example Output

```
Broadcasting pixel update: x=450, y=495, color=#70C7BA
Broadcasting pixel update: x=450, y=505, color=#70C7BA
...
Successfully placed 3200 pixels to form 'KASPA' on the canvas at 10x scale!
```

## Wipe Pixels Script

The `wipe_pixels.py` script allows you to manually wipe all pixels from the database. This script is designed to be run only from within the backend container for security reasons.

### Usage

To run the script, you need to execute it from within the backend container:

```bash
# Connect to the backend container
docker exec -it backend /bin/bash

# Navigate to the utils directory
cd app/utils

# Run the script with the --confirm flag to confirm the wipe
python wipe_pixels.py --confirm
```

Without the `--confirm` flag, the script will only display a warning message and won't delete any pixels.

### Security

This script can only be run from within the container. It checks for the presence of the `/.dockerenv` file, which is automatically created by Docker in all containers. If this file is not found, the script will exit with an error message.

### Functionality

When run with the `--confirm` flag, the script will:

1. Delete all pixels from the database
2. Broadcast a canvas update to all connected clients
3. Print the number of pixels that were deleted

### Example Output

```
Successfully wiped 1234 pixels from the database.
Broadcast canvas update to all connected clients.
```

### Warning

Use this script with caution! It will permanently delete all pixels from the canvas. This action cannot be undone.