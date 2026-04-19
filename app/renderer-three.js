import * as THREE from 'three';
import { app, getCOL, getRAD } from './state.js';

let scene, camera, renderer, atomGroup;

export function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);

    scene = new THREE.Scene();

    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0, 40);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    atomGroup = new THREE.Group();
    scene.add(atomGroup);
}

export function draw() {
    if (!renderer || !scene || !camera) return;

    atomGroup.children.slice().forEach(child => atomGroup.remove(child));

    for (const atom of app.atoms) {
        const radius = getRAD(atom.t) * 0.15;
        const geo = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(getCOL(atom.t)) });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(atom.x, atom.y, atom.z);
        atomGroup.add(mesh);
    }

    atomGroup.rotation.y = app.angleY || 0;
    atomGroup.rotation.x = app.angleX || 0;

    renderer.render(scene, camera);
}
