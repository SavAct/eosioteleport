/**
 * Convert an Uint8Array to an hex in string format
 * @param bytes Uint8Array
 * @returns Hex in string format
 */
export const toHexString = (bytes: Uint8Array) => {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
}

/**
 * Convert a hex in string format to an Uint8Array
 * @param hexString Hex in string format
 * @returns Uint8Array
 */
export const fromHexString = (hexString: string) => {
    let str = hexString.match(/.{1,2}/g)
    return str == null? new Uint8Array() : new Uint8Array(str.map(byte => parseInt(byte, 16)))
}

/**
 * Use this function with await to let the thread sleep for the defined amount of time
 * @param ms Milliseconds
 */
export const sleep = async (ms: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}


export function hexToString(hexString: string) {
    const reg = hexString.match(/.{1,2}/g)
    let str = ''
    if(reg != null){
        for (let byte of reg){
            let char = String.fromCharCode(parseInt(byte, 16))
            if(char == '\x00'){
                break
            }
            str += char
        }
    }
    return str
}