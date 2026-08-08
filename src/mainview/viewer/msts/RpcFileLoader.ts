import { MstsObject, MstsParser } from "msts-parser";
import { IMstsLoader } from "./IMstsLoader";
import { rpc } from '../../main'

export class RpcFileLoader implements IMstsLoader {

    private readonly mstsParser: MstsParser

    constructor() {
        this.mstsParser = new MstsParser();
    }

    async load(url: string): Promise<MstsObject> {
        const file = await rpc.request.getFileUrl({ path: url });
        const response = await fetch(file.url);

        if (!response.ok) {
            throw new Error(`Failed to read ${url}: HTTP ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const result = await this.mstsParser.parse(arrayBuffer, url);

        return result;
    }
}
