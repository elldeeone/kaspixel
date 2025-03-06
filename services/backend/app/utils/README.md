# Utility Scripts

This directory contains utility scripts for managing the Kaspixel application.

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