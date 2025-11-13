const { spawnSync } = require('child_process');
const path = require('path');

const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const args = ['node', viteBin, 'build'];

// Spawn Node to run the vite JS file directly
const result = spawnSync(process.execPath, [viteBin, 'build'], { stdio: 'inherit', env: process.env });

process.exit(result.status || 0);
