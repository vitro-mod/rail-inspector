import * as THREE from 'three';
// import * as WebGPU from 'three/webgpu';
import { MstsTexture } from 'msts-parser';
import { IMstsLoader } from './IMstsLoader';
import { Cache, disposeTexture } from '../Cache';
import { InFlightMap } from '../utils/InFlightMap';
type TextureInit = (texture: THREE.Texture) => Promise<void> | void;

export class MstsTextureLoader {

    cache: Cache;
    mstsLoader: IMstsLoader;
    // fallbackMaterial: WebGPU.NodeMaterial;
    fallbackTexture: THREE.Texture;
    initTextureAsync?: TextureInit;
    private textureLoading = new InFlightMap<string, THREE.Texture>();

    constructor(cache: Cache, mstsLoader: IMstsLoader, options?: { initTextureAsync?: TextureInit }) {
        this.cache = cache;
        this.mstsLoader = mstsLoader;
        this.initTextureAsync = options?.initTextureAsync;
        this.fallbackTexture = this.initTexture(new THREE.TextureLoader().load('grid.png'));
        // this.fallbackMaterial = new WebGPU.MeshBasicNodeMaterial({ map: this.fallbackTexture });
        // this.roughness = roughness;
    }

    async load(url: string): Promise<THREE.Texture> {

        const lower = url.toLowerCase();

        // Check cache first before loading
        if (this.cache.texture.has(lower)) {
            return this.cache.texture.get(lower) as THREE.Texture;
        }

        return this.textureLoading.getOrCreate(lower, async () => {
            try {
                const mstsTexture = await this.mstsLoader.load(url) as MstsTexture;

                const texture = this.createTexture(mstsTexture);
                await this.initTextureAsync?.(texture);

                this.cache.texture.set(lower, texture);

                // console.log('loaded texture:', url, texture);
                return texture;

            } catch (e) {
                console.warn('Failed to load texture:', url, 'using fallback');
                return this.fallbackTexture;
            }
        });
    }

    private createTexture(mstsTexture: MstsTexture): THREE.Texture {
        const texture = this.initTexture(new THREE.Texture(mstsTexture.bitmap));

        return texture;
    }

    private initTexture(texture: THREE.Texture): THREE.Texture {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        texture.needsUpdate = true;
        texture.anisotropy = 16;

        return texture;
    }

    dispose(): void {
        this.textureLoading.clear();
        disposeTexture(this.fallbackTexture);
    }
}
