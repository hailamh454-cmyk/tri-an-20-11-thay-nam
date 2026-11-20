import * as THREE from 'three';

const camera = new THREE.PerspectiveCamera(46, 16 / 9, 1, 2000);
// Camera at (52, 160, 50), looking at board center (52, 155, 480)
camera.position.set(52, 160, 50);
camera.lookAt(52, 155, 480);
camera.updateMatrixWorld();

const boardCenter = new THREE.Vector3(51.94, 162.45, 480.0);
const deskCenter = new THREE.Vector3(2.44, 39.11, 343.40);
const windowPoint = new THREE.Vector3(391.5, 204.5, 237.3);
const doorPoint = new THREE.Vector3(-396.0, 132.5, -242.6);

const bcProj = boardCenter.clone().project(camera);
const dcProj = deskCenter.clone().project(camera);
const winProj = windowPoint.clone().project(camera);
const doorProj = doorPoint.clone().project(camera);

console.log('Official Three.js project:');
console.log('Board Center NDC:', bcProj.x.toFixed(3), bcProj.y.toFixed(3));
console.log('Desk Center NDC:', dcProj.x.toFixed(3), dcProj.y.toFixed(3));
console.log('Window (+X=391.5) NDC:', winProj.x.toFixed(3), winProj.y.toFixed(3));
console.log('Door (-X=-396) NDC:', doorProj.x.toFixed(3), doorProj.y.toFixed(3));
