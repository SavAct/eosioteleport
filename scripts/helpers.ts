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

/**
 * Wait for a defined amount of time and show remaining seconds if the log output is a teletypewriter (editable console)
 * @param s Seconds to wait
 */
    export const WaitWithAnimation = async (s: number, info: string = '') => {
    if(process.stdout.isTTY){
        process.stdout.write(info + "\n\x1b[?25l")
        for(let i = 0; i < s; i++){
            process.stdout.write(`💤 ${i} s / ${s} s 💤`)
            await sleep(1000)
            process.stdout.write("\r\x1b[K")
        }
        process.stdout.moveCursor(0, -1) // up one line
        process.stdout.clearLine(1) // from cursor to end
    } else {
        console.log(info)
        await sleep(s*1000)
    }
}