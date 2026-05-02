#!/bin/bash
set -e

echo ""
echo ">>> Step 1/7: TypeScript compile"
npm run build

echo ""
echo ">>> Step 2/7: Bundle with esbuild"
npx esbuild dist/index.js \
  --bundle \
  --platform=node \
  --external:node-hid \
  --outfile=dist/bundle.js

echo ""
echo ">>> Step 3/7: Generate SEA blob"
node --experimental-sea-config sea-config.json

echo ""
echo ">>> Step 4/7: Copy node binary"
cp /usr/bin/node dist/myapp

echo ""
echo ">>> Step 5/7: Inject blob"
npx postject dist/myapp NODE_SEA_BLOB dist/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
chmod +x dist/myapp

echo ""
echo ">>> Step 6/7: Deploy to /opt/restlab"
cp dist/myapp /opt/restlab/myapp

echo ""
echo ">>> Step 7/7: Restart service"
sudo systemctl restart backend.service
sudo systemctl status backend.service --no-pager

echo ""
echo "=== Done! ==="
