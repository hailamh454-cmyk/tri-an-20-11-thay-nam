import fs from 'fs';
import path from 'path';

// Load GLTF JSON and find all objects
const glbPath = path.resolve('assets/classroom.glb');
const buffer = fs.readFileSync(glbPath);
let offset = 12;
const totalLength = buffer.readUInt32LE(8);
let jsonChunk = null;
while (offset < totalLength) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  if (chunkType === 0x4E4F534A) {
    jsonChunk = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'));
  }
  offset += 8 + chunkLength;
}

const nodes = jsonChunk.nodes;
console.log('--- ALL KEY OBJECTS WORLD POSITIONS ---');
// Let's print nodes that have mesh or interesting names
// Use analyze_glb logic
import('./analyze_glb.js');
