import fs from 'fs';
import path from 'path';

const glbPath = path.resolve('assets/classroom.glb');
const buffer = fs.readFileSync(glbPath);

const magic = buffer.readUInt32LE(0);
const version = buffer.readUInt32LE(4);
const totalLength = buffer.readUInt32LE(8);

console.log('Magic:', magic.toString(16), 'Version:', version, 'Total Length:', totalLength);

let offset = 12;
let jsonChunk = null;

while (offset < totalLength) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  console.log(`Chunk at offset ${offset}: length=${chunkLength}, type=0x${chunkType.toString(16)}`);
  
  if (chunkType === 0x4E4F534A) { // 'JSON'
    const jsonStr = buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8');
    jsonChunk = JSON.parse(jsonStr);
  }
  offset += 8 + chunkLength;
}

if (!jsonChunk) {
  console.error('No JSON chunk found');
  process.exit(1);
}

console.log('GLTF JSON summary:');
console.log('Scenes count:', jsonChunk.scenes?.length);
console.log('Default scene:', jsonChunk.scene);
console.log('Nodes count:', jsonChunk.nodes?.length);
console.log('Meshes count:', jsonChunk.meshes?.length);
console.log('Materials count:', jsonChunk.materials?.length);
console.log('Accessors count:', jsonChunk.accessors?.length);

console.log('\nNode names:');
jsonChunk.nodes?.forEach((node, idx) => {
  console.log(`[${idx}] "${node.name || 'unnamed'}" (mesh: ${node.mesh !== undefined ? node.mesh : 'none'}, children: ${node.children ? JSON.stringify(node.children) : 'none'})`);
});

console.log('\nMesh names:');
jsonChunk.meshes?.forEach((mesh, idx) => {
  console.log(`[Mesh ${idx}] "${mesh.name || 'unnamed'}" primitives: ${mesh.primitives.length}`);
});

console.log('\nMaterial names:');
jsonChunk.materials?.forEach((mat, idx) => {
  console.log(`[Mat ${idx}] "${mat.name || 'unnamed'}"`);
});
