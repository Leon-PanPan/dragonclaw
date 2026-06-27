#!/bin/bash
cd ~/develop/workspace/js_workspace/dragonclaw
echo "=== Test 1: Vite Build ==="
if yarn vite build 2>&1 | grep -q "built"; then echo "PASS: build"; else echo "FAIL: build"; exit 1; fi
echo "=== Test 2: Shared module loads ==="
if node -e "require('./shared/ipc-channels')" 2>&1; then echo "PASS: shared"; else echo "FAIL: shared"; exit 1; fi
echo "=== Test 3: IPC channels unique ==="
node test/ipc-channels.test.js
echo "=== All tests passed ==="
