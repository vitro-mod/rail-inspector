import * as THREE from 'three';
import * as WebGPU from 'three/webgpu';
import { MstsObject } from 'msts-parser';
import { MstsTile } from 'msts-parser';
import { InFlightMap } from './utils/InFlightMap';

export function disposeTexture(texture: THREE.Texture): void {
    const image = texture.image as { close?: () => void } | null | undefined;

    texture.dispose();
    image?.close?.();

    // Do not retain the (now closed) ImageBitmap through Texture.source.
    texture.image = null;
}

export class Cache {
    loaderResult = new Map<string, MstsObject>();
    texture = new Map<string, THREE.Texture>();
    material = new Map<string, WebGPU.MeshPhongNodeMaterial>();
    geometry = new Map<string, THREE.BufferGeometry[]>();
    tiles = new Map<string, MstsTile>();
    tileShapes = new Map<string, Set<string>>();
    worldGroups = new Map<string, THREE.Group>();
    terrainGroups = new Map<string, Promise<THREE.Group>>();
    alreadyCompiled = new Set<string>();
    private materialInFlight = new InFlightMap<string, WebGPU.MeshPhongNodeMaterial>();

    getOrSet(map: Map<string, any>, key: string, callback: (param: any) => any) {
        let result = map.get(key);

        if (!result) {
            result = callback(key);
            map.set(key, result);
        }

        return;
    }

    async getOrCreateMaterial(key: string, factory: () => Promise<WebGPU.MeshPhongNodeMaterial>): Promise<WebGPU.MeshPhongNodeMaterial> {
        let material = this.material.get(key);

        if (!material) {
            material = await this.materialInFlight.getOrCreate(key, factory);
            this.material.set(key, material);
        }

        return material;
    }

    clear(): void {
        for (const geometries of this.geometry.values()) {
            for (const geometry of geometries) {
                geometry.dispose();
            }
        }

        for (const material of new Set(this.material.values())) {
            material.dispose();
        }

        for (const texture of new Set(this.texture.values())) {
            disposeTexture(texture);
        }

        this.loaderResult.clear();
        this.texture.clear();
        this.material.clear();
        this.geometry.clear();
        this.tiles.clear();
        this.tileShapes.clear();
        this.worldGroups.clear();
        this.terrainGroups.clear();
        this.alreadyCompiled.clear();
        this.materialInFlight.clear();
    }
}
