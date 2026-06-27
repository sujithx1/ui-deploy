#!/bin/bash
# deploy.sh
# Usage: ./deploy.sh <deploymentId> <deploymentPath> <pm2ProcessName> <port> <buildFolder> <framework>

set -e # Exit immediately on error

DEPLOYMENT_ID=$1
DEPLOYMENT_PATH=$2
PM2_PROCESS_NAME=$3
PORT=$4
BUILD_FOLDER=$5
FRAMEWORK=$6 # e.g. nextjs, static, bun, node

TAR_FILE="/tmp/${DEPLOYMENT_ID}.tar.gz"
TEMP_EXTRACT_DIR="/tmp/extract_${DEPLOYMENT_ID}"

echo "=== Deployment started for ID: ${DEPLOYMENT_ID} ==="
echo "Target Path: ${DEPLOYMENT_PATH}"
echo "PM2 Process Name: ${PM2_PROCESS_NAME}"
echo "Port: ${PORT}"
echo "Framework: ${FRAMEWORK}"

# 1. Validate tarball exists
if [ ! -f "$TAR_FILE" ]; then
  echo "Error: Uploaded file $TAR_FILE not found."
  exit 1
fi

# 2. Extract tarball
echo "Extracting archive to ${TEMP_EXTRACT_DIR}..."
mkdir -p "$TEMP_EXTRACT_DIR"
tar -xzf "$TAR_FILE" -C "$TEMP_EXTRACT_DIR"

# 3. Basic validation
if [ "$FRAMEWORK" != "static" ]; then
  if [ ! -f "${TEMP_EXTRACT_DIR}/package.json" ]; then
    echo "Warning: package.json not found in the uploaded archive. Proceeding anyway."
  fi
fi

# 4. Prepare target directory
echo "Preparing deployment target folder ${DEPLOYMENT_PATH}..."
mkdir -p "$(dirname "$DEPLOYMENT_PATH")"

# Atomic swap or directory replacement
# To keep it simple and clean:
# Remove old deployment directory and move the extracted files there
if [ -d "$DEPLOYMENT_PATH" ]; then
  echo "Backing up existing deployment..."
  rm -rf "${DEPLOYMENT_PATH}.bak"
  mv "$DEPLOYMENT_PATH" "${DEPLOYMENT_PATH}.bak"
fi

echo "Moving new version to target path..."
mv "$TEMP_EXTRACT_DIR" "$DEPLOYMENT_PATH"

# 5. Handle PM2 Process Management (Only for non-static apps)
if [ "$FRAMEWORK" != "static" ]; then
  echo "Restarting application using PM2..."
  
  # Navigate to app directory to run PM2 commands
  cd "$DEPLOYMENT_PATH"
  
  # Determine start script command
  # We check for Bun or Next or standard node start
  if [ "$FRAMEWORK" == "nextjs" ]; then
    # Start command for Next.js
    pm2 delete "$PM2_PROCESS_NAME" 2>/dev/null || true
    PORT=$PORT pm2 start "bun next start -p $PORT" --name "$PM2_PROCESS_NAME" || \
    PORT=$PORT pm2 start "node_modules/next/dist/bin/next start -p $PORT" --name "$PM2_PROCESS_NAME" || \
    PORT=$PORT pm2 start "bun run start" --name "$PM2_PROCESS_NAME"
  elif [ "$FRAMEWORK" == "bun" ]; then
    pm2 delete "$PM2_PROCESS_NAME" 2>/dev/null || true
    pm2 start "bun run start" --name "$PM2_PROCESS_NAME" -- --port "$PORT" || \
    pm2 start "bun src/index.ts" --name "$PM2_PROCESS_NAME" -- --port "$PORT"
  else
    # Fallback to general node start
    pm2 delete "$PM2_PROCESS_NAME" 2>/dev/null || true
    pm2 start "npm run start" --name "$PM2_PROCESS_NAME" -- --port "$PORT"
  fi
  
  pm2 save
  echo "PM2 process successfully configured."
else
  echo "Static deployment detected. Skipping PM2."
fi

# 6. Cleanup temp files
echo "Cleaning up temporary files..."
rm -f "$TAR_FILE"
rm -rf "/tmp/extract_${DEPLOYMENT_ID}"
if [ -d "${DEPLOYMENT_PATH}.bak" ]; then
  rm -rf "${DEPLOYMENT_PATH}.bak"
fi

echo "=== Deployment successfully completed! ==="
exit 0
