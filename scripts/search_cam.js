import * as THREE from 'three';

const boardCenter = new THREE.Vector3(51.94, 162.45, 480.0);
const deskCenter = new THREE.Vector3(2.44, 39.11, 343.40);
const deskMin = new THREE.Vector3(-85.83, -0.38, 290.32);
const deskMax = new THREE.Vector3(90.71, 78.60, 396.47);

const boardMin = new THREE.Vector3(-248.86, 78.39, 480.0);
const boardMax = new THREE.Vector3(352.73, 246.51, 480.0);

const camera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 2000);

console.log('Searching for camera positions where Desk is in bottom-left and Board is centered:');

for (let x = -300; x <= -100; x += 25) {
  for (let y = 100; y <= 180; y += 20) {
    for (let z = -200; z <= 200; z += 50) {
      camera.position.set(x, y, z);
      // Look at a target point on the board
      camera.lookAt(boardCenter);
      camera.updateMatrixWorld();

      const bc = boardCenter.clone().project(camera);
      const dc = deskCenter.clone().project(camera);

      // We want Desk at bottom-left: dc.x in [-0.7, -0.2], dc.y in [-0.9, -0.4]
      // And board visible and roughly centered: bc.x in [-0.2, 0.2]
      if (dc.x >= -0.7 && dc.x <= -0.15 && dc.y >= -0.95 && dc.y <= -0.4) {
        console.log(`Pos: [${x}, ${y}, ${z}] => Desk NDC: (${dc.x.toFixed(2)}, ${dc.y.toFixed(2)}), Board Center NDC: (${bc.x.toFixed(2)}, ${bc.y.toFixed(2)})`);
      }
    }
  }
}
