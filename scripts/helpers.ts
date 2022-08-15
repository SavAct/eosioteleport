import fs from 'fs';

export interface Asset {
    amount: bigint;
    symbol: { precision: number; name: string };
}

/**
 * Convert an Uint8Array to an hex in string format
 * @param bytes Uint8Array
 * @returns Hex in string format
 */
export const toHexString = (bytes: Uint8Array) => {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
};

/**
 * Convert a hex in string format to an Uint8Array
 * @param hexString Hex in string format
 * @returns Uint8Array
 */
export const fromHexString = (hexString: string) => {
    let str = hexString.match(/.{1,2}/g);
    return str == null ? new Uint8Array() : new Uint8Array(str.map((byte) => parseInt(byte, 16)));
};

/**
 * Use this function with await to let the thread sleep for the defined amount of time
 * @param ms Milliseconds
 */
export const sleep = async (ms: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

/**
 * Convert a hex string into a string
 * @param hexString
 * @returns
 */
export function hexToString(hexString: string) {
    const reg = hexString.match(/.{1,2}/g);
    let str = '';
    if (reg != null) {
        for (let byte of reg) {
            let char = String.fromCharCode(parseInt(byte, 16));
            if (char == '\x00') {
                break;
            }
            str += char;
        }
    }
    return str;
}

/**
 * Convert the data of an asset to a string
 * @param amount
 * @param symbol_name
 * @param precision
 * @returns
 */
export const assetdataToString = (amount: bigint, symbol_name: string, precision: number) => {
    let s = amount.toString().padStart(precision, '0');
    let p = s.length - precision;
    let int = s.substring(0, p);
    return `${int ? int : '0'}${'.'}${s.substring(p)} ${symbol_name}`;
};

/**
 * Convert the data of an asset to a string
 * @param asset
 * @returns
 */
export const assetToString = (asset: Asset) => {
    return assetdataToString(asset.amount, asset.symbol.name, asset.symbol.precision);
};

/**
 * Convert a string to an asset object
 * @param asset_str
 * @returns
 */
export const stringToAsset = (asset_str: string): Asset => {
    if (typeof asset_str != 'string') {
        throw `Asset string is not defined`;
    }
    let s = asset_str.indexOf('.');
    if (s == -1) {
        throw `Missing precision of asset string: ${asset_str}`;
    }
    let e = asset_str.indexOf(' ', s);
    if (e == -1) {
        throw `Missing symbol of asset string: ${asset_str}`;
    }
    let precision = e - s - 1;
    let name = asset_str.substring(e + 1).trim();
    let amount = BigInt(asset_str.substring(0, s) + asset_str.substring(s + 1, e));
    return { amount, symbol: { precision, name } };
};

/**
 * Wait for a defined amount of time and show remaining seconds if the log output is a teletypewriter (editable console)
 * @param s Seconds to wait
 */
export const WaitWithAnimation = async (s: number, info: string = '') => {
    if (process.stdout.isTTY) {
        process.stdout.write(info + '\n\x1b[?25l');
        for (let i = 0; i < s; i++) {
            process.stdout.write(`💤 ${i} s / ${s} s 💤`);
            await sleep(1000);
            process.stdout.write('\r\x1b[K');
        }
        process.stdout.moveCursor(0, -1); // up one line
        process.stdout.clearLine(1); // from cursor to end
    } else {
        console.log(info);
        await sleep(s * 1000);
    }
};

/**
 * Load a number from file if it exists
 * @param file Path with name of the file
 * @returns a saved id number otherwise throw an error
 */
export const load_number_from_file = async (file: string) => {
    //   let block_number: string | number = 'latest'
    if (!fs.existsSync(file)) {
        throw new Error('File does not exist');
    }

    const file_contents = fs.readFileSync(file).toString();
    if (!file_contents) throw new Error('No content in file');

    const block_number = parseInt(file_contents);
    if (isNaN(block_number)) throw new Error('No number in file');

    return block_number;
};

/**
 * Save a number to a file
 * @param num Number which should be stored
 * @param file Name of the file
 */
export const save_number_to_file = async (num: number, file: string) => {
    fs.writeFileSync(file, num.toString());
};
