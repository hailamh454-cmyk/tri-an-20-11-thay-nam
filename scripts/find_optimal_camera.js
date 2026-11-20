import * as THREE from 'three';

const boardCenter = new THREE.Vector3(51.94, 162.45, 480.0);
const deskCenter = new THREE.Vector3(2.44, 39.11, 343.40);
const deskMin = new THREE.Vector3(-85.83, -0.38, 290.32);
const deskMax = new THREE.Vector3(90.71, 78.60, 396.47);

const camera = new THREE.PerspectiveCamera(48, 16 / 9, 1, 2000);

for (let x = -150; x <= 200; x += 50) {
  for (let y of [140, 160, 180]) {
    for (let z of [0, 50, 100]) {
      camera.position.set(x, y, z);
      camera.lookAt(boardCenter);
      camera.updateMatrixWorld();

      const bc = boardCenter.clone().project(camera);
      const dc = deskCenter.clone().project(camera);
      const dMin = deskMin.clone().project(camera);
      const dMax = deskMax.clone().project(camera);

      // We want Desk at bottom-left: dc.x in [-0.9, -0.1], dc.y in [-0.9, -0.3]
      console.log(`Cam pos [${x}, ${y}, ${z}] => Board NDC: (${bc.x.toFixed(2)}, ${bc.y.toFixed(2)}), Desk NDC: (${dc.x.toFixed(2)}, ${dc.y.toFixed(2)}), Desk X range: [${Math.min(dMin.x, dMax.x).toFixed(2)}, ${Math.max(dMin.x, dMax.x).toFixed(2)}]`);
    }
  }
}
