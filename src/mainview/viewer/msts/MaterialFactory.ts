import { LightMatID, MstsShape, UvOp } from 'msts-parser';
import * as THREE from 'three';
import * as TSL from 'three/tsl';
import * as WebGPU from 'three/webgpu';
import { Cache } from '../Cache';
import { MstsTextureLoader } from './MstsTextureLoader';
import { InFlightMap } from '../utils/InFlightMap';

export class MaterialFactory {

    cache: Cache;
    textureLoader: MstsTextureLoader;
    private materialLoading = new InFlightMap<string, WebGPU.MeshPhongNodeMaterial>();

    constructor(cache: Cache, textureLoader: MstsTextureLoader) {
        this.cache = cache;
        this.textureLoader = textureLoader;
    }

    async getForShape(shape: MstsShape, primStateIdx: number, urlBase: string = ''): Promise<WebGPU.NodeMaterial> {
        const primState = shape.primStates[primStateIdx];
        const aceFileNames = primState.texIdxs.map((idx: number) => {
            const texture = shape.textures[idx];
            return urlBase + shape.images[texture.imageIdx];
        });
        const vtxState = shape.vtxStates[primState.vStateIndex];

        const lightCfg = shape.lightModelCfgs[vtxState.lightCfgIdx];
        const uvOps = lightCfg.uvOps;
        const uvOpsExecuted = uvOps.map((uvOp: any) => this.executeUvOp(TSL.uv(), uvOp));

        const shader = shape.shaders[primState.shaderIndex];
        const alphaTest = primState.alphaTestMode ? 0.5 : 0;

        const mat = this.get(aceFileNames, vtxState.lightMatIdx, shader, alphaTest, uvOpsExecuted);

        return mat;
    }

    async get(aceFileNames: string[], lightMatIdx: number, shader: string = 'Tex', alphaTest: number = 0, uvOpsExecuted?: WebGPU.Node[]): Promise<WebGPU.MeshPhongNodeMaterial> {
        const aceFileNamesLower = aceFileNames.map((name: string) => name.toLowerCase());
        const matCacheKey = aceFileNamesLower.join(':') + ':' + lightMatIdx + ':' + shader;
        let material = this.cache.material.get(matCacheKey);
        if (material) {
            return material;
        }

        return this.materialLoading.getOrCreate(matCacheKey, async () => {
            const readyMaterial = await this.buildMaterial(aceFileNames, lightMatIdx, shader, alphaTest, uvOpsExecuted);
            this.cache.material.set(matCacheKey, readyMaterial);
            return readyMaterial;
        });
    }

    private async buildMaterial(aceFileNames: string[], lightMatIdx: number, shader: string, alphaTest: number, uvOpsExecuted?: WebGPU.Node[]): Promise<WebGPU.MeshPhongNodeMaterial> {
        const material = new WebGPU.MeshPhongNodeMaterial();

        material.userData.aceFileNames = aceFileNames;
        material.userData.lightMatIdx = lightMatIdx;
        material.userData.shader = shader;

        const isBlend = shader ? shader.substr(0, 5).toLowerCase() === 'blend' : false;
        const transparent = isBlend || shader === 'AlphRefMap';

        material.transparent = transparent;
        material.alphaTest = alphaTest;

        const color1 = TSL.attribute('color1', 'vec4' as const);
        const color2 = TSL.attribute('color2', 'vec4' as const);

        material.userData.dayFactor = TSL.uniform(1.0);
        const dayFactor = material.userData.dayFactor;

        const vertexRgb = color1.rgb.mul(dayFactor).add(color2.rgb);
        const vertexAlpha = color1.a.add(TSL.float(isBlend ? 0 : 1));
        const vertexColor = TSL.vec4(vertexRgb, vertexAlpha);

        const textures = await Promise.all(aceFileNames.map((aceFileName: string) => this.textureLoader.load(aceFileName)));
        let texture;

        if (!uvOpsExecuted) {
            uvOpsExecuted = [TSL.uv()];
        }

        switch (shader) {
            case 'DetailMod2X':
            case 'DetailTerrain':
                texture = TSL.texture(textures[0], uvOpsExecuted[0]).mul(TSL.texture(textures[1], uvOpsExecuted[1])).mul(2);
                break;
            case 'GlossMap':
                texture = TSL.texture(textures[0], uvOpsExecuted[0]).add(TSL.texture(textures[1], uvOpsExecuted[1]));
                break;
            case 'AlphRefMap':
                const arg1 = TSL.texture(textures[0], uvOpsExecuted[0]);
                const arg2 = TSL.texture(textures[1], uvOpsExecuted[1]);
                const rgb = arg1.aaa.oneMinus().mul(arg2.rgb).add(arg1).rgb;
                const a = arg1.a.add(color1.a);
                texture = TSL.vec4(rgb, a);
                break;
            default:
                texture = TSL.texture(textures[0], uvOpsExecuted[0]);
                break;
        }

        material.colorNode = texture;

        switch (lightMatIdx) {
            case LightMatID.specular0:
                material.shininess = 0;
                material.specular = new THREE.Color(0x000000);
                material.colorNode = TSL.vec4(texture.rgb, TSL.mul(texture.a, vertexColor.a));
                /** @ts-ignore */
                material.emissiveNode = texture.mul(vertexColor);
                material.lightsNode = TSL.lights();
                break;
            case LightMatID.OptSpecular25:
                material.shininess = 100;
                material.specularNode = texture.bbb.pow2();
                break;
            case LightMatID.OptSpecular750:
                material.shininess = 25;
                material.specular = new THREE.Color(0xffffff);
                break;
            case LightMatID.OptFullbright:
                material.shininess = 0;
                material.specular = new THREE.Color(0x000000);
                /** @ts-ignore */
                material.emissiveNode = texture;
                material.lightsNode = TSL.lights();
                break;
            case LightMatID.Cruciform:
            case LightMatID.CruciformLong:
                material.shininess = 0;
                material.specular = new THREE.Color(0x000000);
                // material.normalNode is expected in view space.
                // Keep foliage lit as "world up" by transforming +Y from world to view.
                material.normalNode = TSL.cameraViewMatrix.transformDirection(TSL.vec3(0, 1, 0)).normalize();
                break;
            default:
                material.shininess = 0;
                material.specular = new THREE.Color(0x000000);
        }

        if (shader === 'nightlight') {
            material.colorNode = texture.mul(dayFactor.oneMinus());
            /** @ts-ignore */
            material.emissiveNode = texture.mul(dayFactor.oneMinus());
            material.blending = THREE.AdditiveBlending;
            material.transparent = true;
        }

        material.needsUpdate = true;
        return material;
    }

    private executeUvOp(uv: WebGPU.AttributeNode<'vec2'>, op: UvOp): WebGPU.Node {

        switch (op.uvOp) {
            case 'nonuniformscale':
                return uv.mul(TSL.vec2(op.uScale, op.vScale));
            case 'uniformscale':
                return uv.mul(TSL.float(op.scale));
            case 'reflectmapfull':
                return TSL.equirectUV(TSL.reflectView);
            case 'reflectmap':
                return TSL.equirectUV(TSL.reflectView);
            case 'spheremap':
                return TSL.spherizeUV(TSL.reflectView, uv.mul(0.00001));
            case 'spheremapfull':
                return TSL.spherizeUV(TSL.reflectView, TSL.vec2(0, 0));
            case 'specularmap':
                return TSL.equirectUV(TSL.reflectView);
            case 'transform':
                // Apply transformation matrix
                return TSL.vec2(
                    uv.x.mul(op.e11).add(uv.y.mul(op.e21)).add(op.e31),
                    uv.x.mul(op.e12).add(uv.y.mul(op.e22)).add(op.e32)
                );
            case 'embossbump':
                return uv.add(TSL.vec2(op.uvShiftScale, op.uvShiftScale));
            case 'share':
                // Share references another UV op - would need to resolve the referenced op
                return uv;
            case 'copy':
            default:
                return uv;
        }
    }
}
