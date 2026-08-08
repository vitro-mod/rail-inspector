import * as THREE from 'three';
import * as WebGPU from 'three/webgpu';
import { MstsShape } from 'msts-parser';
import { MstsTextureLoader } from './MstsTextureLoader';
import { IMstsLoader } from './IMstsLoader';
import { Cache } from '../Cache';
import { GeometryFactory } from './GeometryFactory';
import { MaterialFactory } from './MaterialFactory';

export type InstancedShape = {
    matrices: THREE.Group[],
    meshes: THREE.InstancedMesh[] | THREE.Mesh[],
    root: THREE.Group,
}

export class MstsShapeLoader {

    cache: Cache;
    mstsLoader: IMstsLoader;
    mstsTextureLoader: MstsTextureLoader;
    geometryFactory: GeometryFactory;
    materialFactory: MaterialFactory;

    constructor(cache: Cache, mstsLoader: IMstsLoader, mstsTextureLoader: MstsTextureLoader, materialFactory: MaterialFactory, geometryFactory: GeometryFactory) {
        this.cache = cache;
        this.mstsLoader = mstsLoader;
        this.mstsTextureLoader = mstsTextureLoader;
        this.geometryFactory = geometryFactory;
        this.materialFactory = materialFactory;
        // this.roughness = roughness;
    }

    public async load(url: string, urlBase: string, _roOffset: number = 0): Promise<THREE.LOD> {
        let shape;
        try {
            shape = await this.mstsLoader.load(url) as MstsShape;
        } catch (e) {
            console.error(e);
            throw new Error('Failed to load model: ' + url);
        }

        // if (shape.sort_vectors.length) {
        // console.log('SORT_VECTORS:', shape, shape.sort_vectors);
        // }

        const group = await this.getMstsModel(shape, url, urlBase);

        // console.log('Loaded shape:', group);

        return group;
    }

    public async loadInstanced(url: string, urlBase: string, count: number): Promise<InstancedShape> {
        let shape;
        try {
            shape = await this.mstsLoader.load(url) as MstsShape;
        } catch (e) {
            throw new Error('Failed to load model: ' + url);
        }


        // if (shape.sort_vectors.length) {
        // console.log('SORT_VECTORS:', shape, shape.sort_vectors);
        // }

        const group = await this.getMstsModelInstanced(shape, url, urlBase, count);

        // console.log('Loaded shape:', group);

        return group;
    }

    async getMstsModel(shape: MstsShape, url: string, urlBase: string, instanceCount = 0): Promise<THREE.LOD> {

        const lower = url.toLowerCase();

        // console.log(shape);

        const result = new THREE.LOD();

        let geometries = this.cache.geometry.get(lower);
        if (!geometries) {
            geometries = this.geometryFactory.createForShape(shape);
            this.cache.geometry.set(lower, geometries);
        }

        // for (let dLevelIdx = 0; dLevelIdx < shape.distLevels.length; dLevelIdx++) {
        const dLevelIdx = 0; // TODO: use the correct level index

        // if (shape.animations && shape.animations.length > 0) {
        //     shapeData.animations = shape.animations;
        // }

        const materials = await Promise.all(this.loadDataMaterials(shape, geometries, urlBase));

        const matricies = this.loadDataMatricies(shape, dLevelIdx);
        const root = this.buildHierarchy(matricies);

        const meshes = this.createMeshes(dLevelIdx, matricies, geometries, materials, instanceCount);
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            matricies[mesh.userData.matrixIndex].add(mesh);
        }

        result.name = url;
        result.userData.url = url;
        result.addLevel(root, shape.distLevels[dLevelIdx].dist);
        // }

        return result;
    }

    async getMstsModelInstanced(shape: MstsShape, url: string, urlBase: string, instanceCount = 0): Promise<InstancedShape> {

        const lower = url.toLowerCase();

        // console.log(shape);
        const result = new THREE.LOD();

        let geometries = this.cache.geometry.get(lower);
        if (!geometries) {
            geometries = this.geometryFactory.createForShape(shape);
            this.cache.geometry.set(lower, geometries);
        }

        // for (let dLevelIdx = 0; dLevelIdx < shape.distLevels.length; dLevelIdx++) {
        const dLevelIdx = 0; // TODO: use the correct level index

        // if (shape.animations && shape.animations.length > 0) {
        //     shapeData.animations = shape.animations;
        // }

        const materials = await Promise.all(this.loadDataMaterials(shape, geometries, urlBase));

        const matricies = this.loadDataMatricies(shape, dLevelIdx);
        const root = this.buildHierarchy(matricies);
        root.userData.url = url;

        const meshes = this.createMeshes(dLevelIdx, matricies, geometries, materials, instanceCount);
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            mesh.userData.url = url;
        }

        result.addLevel(root, shape.distLevels[dLevelIdx].dist);
        // }

        return { matrices: matricies, meshes, root };
        // return result;
    }

    private buildHierarchy(matricies: THREE.Group[]): THREE.Group {
        let root: THREE.Group | null | undefined = null;
        for (let i = 0; i < matricies.length; i++) {
            const parent = matricies[i].userData.parent < -1 ? 0 : matricies[i].userData.parent;
            const obj = matricies[i];
            if (parent === -1) {
                root = obj;
            } else {
                matricies[parent].add(obj);
            }
        }

        if (!root) {
            throw new Error('Unable to find parent!');
        }

        // root.updateMatrixWorld();
        // root.traverse(obj => console.log(obj.matrixWorld.elements));

        return root;
    }

    private loadDataMatricies(shape: MstsShape, dLevelIdx: number): THREE.Group[] {
        const result: THREE.Group[] = [];

        for (let i = 0; i < shape.matrices.length; i++) {
            const m = shape.matrices[i].mat;
            const matrix = new THREE.Matrix4().set(
                m[0], m[3], m[6], m[9],
                m[1], m[4], m[7], m[10],
                m[2], m[5], m[8], m[11],
                0, 0, 0, 1
            );

            const object = new THREE.Group();
            const name = shape.matrices[i].name;
            const parent = shape.distLevels[dLevelIdx].hierarchy[i];
            const part = -1;

            const flipZ = new THREE.Matrix4().makeScale(1, 1, -1);
            const correctedMatrix = flipZ.clone().multiply(matrix).multiply(flipZ);
            correctedMatrix.decompose(object.position, object.quaternion, object.scale);
            object.name = name;

            object.userData.matrix = correctedMatrix;
            object.userData.matrixIndex = i;
            object.userData.parent = parent;
            object.userData.part = part;

            result[i] = object;
        }

        return result;
    }

    private loadDataMaterials(shape: MstsShape, geometries: THREE.BufferGeometry[], urlBase: string): Promise<WebGPU.NodeMaterial[]>[] {
        const materialPromises = geometries.map(geometry => Promise.all(
            geometry.userData.primStateIdxs.map((primStateIdx: number) =>
                this.materialFactory.getForShape(shape, primStateIdx, urlBase)
            )
        ));

        return materialPromises;
    }

    private createMeshes(dLevelIdx: number, matricies: THREE.Group[], geometries: THREE.BufferGeometry[], materials: WebGPU.NodeMaterial[][], count: number): THREE.InstancedMesh[] | THREE.Mesh[] {
        // console.log(geometries);

        const result: THREE.InstancedMesh[] | THREE.Mesh[] = [];

        for (let i = 0; i < geometries.length; i++) {
            const geometry = geometries[i];
            if (geometry.userData.dLevelIdx !== dLevelIdx) continue;

            const material = materials[i];

            const mesh = count > 1 ? new THREE.InstancedMesh(geometry, material, count) : new THREE.Mesh(geometry, material);
            // mesh.renderOrder = matricies[geometry.userData.matrixIndex].userData.roOffset + i;
            mesh.name = matricies[geometry.userData.matrixIndex].name;
            // mesh.frustumCulled = false;
            // console.log('created mesh', url, geometry.userData.primStateIdxs, geometry, material, mesh);

            mesh.userData.dLevelIdx = geometry.userData.dLevelIdx;
            mesh.userData.matrixIndex = geometry.userData.matrixIndex;

            result[i] = mesh;
        }

        return result;
    }

    disposeGeometries(url: string) {

        const lower = url.toLowerCase();

        const geometries = this.cache.geometry.get(lower);
        if (!geometries) return;

        for (const geometry of geometries) {
            geometry.dispose();
        }

        this.cache.geometry.delete(lower);
        this.cache.loaderResult.delete(lower);

        // console.log('disposed shape:', url);
    }
}
