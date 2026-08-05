import { MstsObject, MstsParser } from "msts-parser";
import { IMstsLoader } from "./IMstsLoader";
import { rpc } from '../../main'

export class RpcFileLoader implements IMstsLoader {

    private readonly mstsParser: MstsParser

    constructor() {
        this.mstsParser = new MstsParser();
    }

    async load(url: string): Promise<MstsObject> {
        const data = await rpc.request.readFile({ path: url });

        const arrayBuffer = Uint8Array.from(Object.values(data.data));

        const result = await this.mstsParser.parse(arrayBuffer.buffer, url);

        return result;
    }
}