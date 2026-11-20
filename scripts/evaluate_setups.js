import * as THREE from 'three';

const boardCenter = new THREE.Vector3(51.94, 162.45, 480.0);
const deskCenter = new THREE.Vector3(2.44, 39.11, 343.40);
const clockCenter = new THREE.Vector3(-31.2, 277.2, 499.8);

const deskCorners = [
  new THREE.Vector3(-85.83, 78.60, 290.32),
  new THREE.Vector3(90.71, 78.60, 290.32),
  new THREE.Vector3(-85.83, -0.38, 290.32),
  new THREE.Vector3(90.71, -0.38, 290.32),
  new THREE.Vector3(-85.83, 78.60, 396.47),
  new THREE.Vector3(90.71, 78.60, 396.47),
  new THREE.Vector3(-85.83, -0.38, 396.47),
  new THREE.Vector3(90.71, -0.38, 396.47),
];

const boardCorners = [
  new THREE.Vector3(-248.86, 78.39, 480.0),
  new THREE.Vector3(352.73, 78.39, 480.0),
  new THREE.Vector3(-248.86, 246.51, 480.0),
  new THREE.Vector3(352.73, 246.51, 480.0),
];

const testSetups = [
  { name: 'Setup A (Door-side front aisle)', pos: [-220, 145, 120], lookAt: [45, 155, 485], fov: 52 },
  { name: 'Setup B (Student Col 4, Row 1/2 aisle)', pos: [-200, 150, 100], lookAt: [50, 160, 485], fov: 50 },
  { name: 'Setup C (Deep door-side angle)', pos: [-250, 150, 150], lookAt: [40, 155, 485], fov: 52 },
  { name: 'Setup D (Slight left student perspective)', pos: [-150, 145, 80], lookAt: [50, 155, 485], fov: 48 },
  { name: 'Setup E (Classic center-aligned perspective)', pos: [0, 155, 60], lookAt: [52, 155, 485], fov: 46 }
];

testSetups.forEach(s => {
  const camera = new THREE.PerspectiveCamera(s.fov, 16 / 9, 1, 2000);
  camera.position.set(...s.pos);
  camera.lookAt(...s.lookAt);
  camera.updateMatrixWorld();

  console.log(`\n======================================================`);
  console.log(s.name);
  console.log(`Cam Position: [${s.pos.join(', ')}], LookAt: [${s.lookAt.join(', ')}], FOV: ${s.fov}°`);

  const bc = boardCenter.clone().project(camera);
  const dc = deskCenter.clone().project(camera);
  const cc = clockCenter.clone().project(camera);

  const bProjs = boardCorners.map(p => p.clone().project(camera));
  const bMinX = Math.min(...bProjs.map(p => p.x));
  const bMaxX = Math.max(...bProjs.map(p => p.x));
  const bMinY = Math.min(...bProjs.map(p => p.y));
  const bMaxY = Math.max(...bProjs.map(p => p.y));

  const dProjs = deskCorners.map(p => p.clone().project(camera));
  const dMinX = Math.min(...dProjs.map(p => p.x));
  const dMaxX = Math.max(...dProjs.map(p => p.x));
  const dMinY = Math.min(...dProjs.map(p => p.y));
  const dMaxY = Math.max(...dProjs.map(p => p.y));

  console.log(`Board Center: NDC (${bc.x.toFixed(2)}, ${bc.y.toFixed(2)}), Screen: (${((bc.x+1)*50).toFixed(1)}%, ${((1-bc.y)*50).toFixed(1)}%)`);
  console.log(`Board Frame:  X=[${((bMinX+1)*50).toFixed(1)}% to ${((bMaxX+1)*50).toFixed(1)}%], Y=[${((1-bMaxY)*50).toFixed(1)}% to ${((1-bMinY)*50).toFixed(1)}%]`);
  console.log(`Desk Center:  NDC (${dc.x.toFixed(2)}, ${dc.y.toFixed(2)}), Screen: (${((dc.x+1)*50).toFixed(1)}%, ${((1-dc.y)*50).toFixed(1)}%)`);
  console.log(`Desk Frame:   X=[${((dMinX+1)*50).toFixed(1)}% to ${((dMaxX+1)*50).toFixed(1)}%], Y=[${((1-dMaxY)*50).toFixed(1)}% to ${((1-dMinY)*50).toFixed(1)}%]`);
  console.log(`Clock Center: NDC (${cc.x.toFixed(2)}, ${cc.y.toFixed(2)}), Screen: (${((cc.x+1)*50).toFixed(1)}%, ${((1-cc.y)*50).toFixed(1)}%)`);
});
