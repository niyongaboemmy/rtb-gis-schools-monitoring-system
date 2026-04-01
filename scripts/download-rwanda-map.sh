#!/bin/bash

# RTB GIS Schools Monitoring & Intelligence System
# Utility to download and install Rwanda PMTiles map data.

# 1. Configuration
# We use a reliable Protomaps mirror or a public OSM extract.
# Adjust the URL if you have a custom tileset.
RWANDA_PMTILES_URL="https://build.protomaps.com/2026-03-27.pmtiles" # Placeholder for a planet build - ideally use a smaller extract
# For a smaller ROI, use the Protomaps CLI to extract it, or use a pre-rendered one:
# RWANDA_PMTILES_URL="https://example.com/rwanda.pmtiles"

STORAGE_DIR=$(node -e "echo require('dotenv').config({path:'file-server/.env'}).parsed.FILE_SERVER_STORAGE_DIR || 'file-server/storage'")
MAPS_DIR="$STORAGE_DIR/maps"
TARGET_FILE="$MAPS_DIR/rwanda.pmtiles"

echo "----------------------------------------------------"
echo "RTB GIS: Rwanda Map Data Installer"
echo "----------------------------------------------------"

# Create directory
mkdir -p "$MAPS_DIR"

if [ -f "$TARGET_FILE" ]; then
    echo "[!] Rwanda map data already exists at: $TARGET_FILE"
    read -p "Overwrite? (y/N): " confirm
    if [[ $confirm != [yY]* ]]; then
        echo "[*] Aborting."
        exit 0
    fi
fi

echo "[*] Downloading Rwanda map data (PMTiles)..."
echo "[*] Source: $RWANDA_PMTILES_URL"
echo "[*] This may take a few minutes depending on your connection."

# Protomaps builds are huge (planet). For Rwanda only, it's better to use a tool to extract.
# If curl is not enough, we can use pmtiles CLI if installed.
if command -v curl &> /dev/null; then
    # Note: Downloading the FULL planet just for Rwanda is inefficient.
    # We recommend using a custom extract from Protomaps or MapTiler.
    # Below we simulate the placement of the file.
    
    # curl -L "$RWANDA_PMTILES_URL" -o "$TARGET_FILE" --progress-bar
    
    echo ""
    echo "[!] NOTE: Due to the size of map planet files (70GB+), we recommend"
    echo "    obtaining a Rwanda-specific extract from:"
    echo "    1. Protomaps (Custom Extract)"
    echo "    2. MapTiler (OSM Extracts)"
    echo ""
    echo "[*] Once you have 'rwanda.pmtiles', please place it in:"
    echo "    $TARGET_FILE"
else
    echo "[!] Error: curl is not installed."
    exit 1
fi

echo "----------------------------------------------------"
echo "[OK] Map storage directory prepared: $MAPS_DIR"
echo "----------------------------------------------------"
