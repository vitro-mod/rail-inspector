import { MstsObject } from 'msts-parser';

export interface IMstsLoader {
    load(url: string): Promise<MstsObject>;
}