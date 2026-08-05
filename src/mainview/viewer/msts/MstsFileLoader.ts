import * as THREE from 'three';
import { MstsObject } from 'msts-parser';
import { IMstsLoader } from './IMstsLoader';
import { MstsParser } from 'msts-parser';

export class MstsFileLoader implements IMstsLoader {

    fileLoader: THREE.FileLoader;
    mstsParser: MstsParser;
    buffer: any;
    rootPath?: string;

    constructor() {
        THREE.Cache.enabled = false;
        this.fileLoader = new THREE.FileLoader();
        this.fileLoader.setResponseType('arraybuffer');
        this.mstsParser = new MstsParser();
    }

    public setRoot(rootPath: string): this {
        this.rootPath = rootPath;

        return this;
    }

    async load(url: string): Promise<MstsObject> {
        const requestUrl = this.rootPath ? new URL(url, this.rootPath).toString() : url;
        const response = await this.fileLoader.loadAsync(requestUrl);

        if (typeof response === 'string') {
            // console.error(response);
            throw new Error('MstsFileLoader: Response is not an ArrayBuffer!');
        }

        const result = await this.mstsParser.parse(response, requestUrl);

        return result;
    }
}
