#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix chunk loading in webpack-runtime.js
const runtimePath = path.join(
  process.cwd(),
  '.next',
  'server',
  'webpack-runtime.js'
);

if (fs.existsSync(runtimePath)) {
  let content = fs.readFileSync(runtimePath, 'utf8');

  // Replace the chunk loading path to include chunks directory
  content = content.replace(
    'require("./" + __webpack_require__.u(chunkId))',
    'require("./chunks/" + __webpack_require__.u(chunkId))'
  );

  fs.writeFileSync(runtimePath, content);
  console.log('✅ Fixed chunk paths in webpack-runtime.js');
}

// Also create symlinks for chunks in the server directory
const chunksDir = path.join(process.cwd(), '.next', 'server', 'chunks');
const serverDir = path.join(process.cwd(), '.next', 'server');

if (fs.existsSync(chunksDir)) {
  const chunks = fs.readdirSync(chunksDir);
  chunks.forEach((chunk) => {
    const chunkPath = path.join(chunksDir, chunk);
    const symlinkPath = path.join(serverDir, chunk);

    if (!fs.existsSync(symlinkPath)) {
      fs.symlinkSync(chunkPath, symlinkPath);
    }
  });
  console.log('✅ Created symlinks for chunks');
}
