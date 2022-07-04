/*
    This oracle listens to the EOSIO blockchain for new `Teleport` entries.
    
    When a new teleport is added to the EOSIO table, it will call sign the teleport and upload the signature to the EOSIO chain.
 */

process.env.NTBA_FIX_319 = '1' // Needed to disable TelegramBot warning
import { RpcError, Serialize } from 'eosjs'
import { GetTableRowsResult } from 'eosjs/dist/eosjs-rpc-interfaces'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'
import { TextDecoder, TextEncoder } from 'text-encoding'
import { ecsign, keccak, toRpcSig } from 'ethereumjs-util'
import { EosApi } from './EndpointSwitcher'
import { ConfigType, TeleportTableEntry } from './CommonTypes'
import yargs from 'yargs'
import {sleep, toHexString, fromHexString, WaitWithAnimation, save_number_to_file, load_number_from_file} from '../scripts/helpers'
import { TgM } from './TelegramMesseger'
import { ResourcesManager } from './ResourcenManager'

interface EOSIO_Chain_Data {
    tel_contract: string
    short_net_id: Uint8Array
}

class EosOracle {

    private eos_api: EosApi
    private eosio_data : EOSIO_Chain_Data
    public running = false
    private irreversible_time = 0
    static maxWait = 180    // The max amount of seconds to wait to check an entry again if it is irreversible now
    private telegram: TgM
    private rsManager: ResourcesManager

    private id_file_name: string

    
    constructor(private config: ConfigType, private signatureProvider: JsSignatureProvider, private force: boolean){
        this.id_file_name = `.oracle_${config.eos.network}_id-${config.eos.oracleAccount}`
        
        this.telegram = new TgM(config.telegram)
        
        this.eos_api = new EosApi(this.config.eos.netId, this.config.eos.endpoints, this.signatureProvider)
        this.rsManager = new ResourcesManager(this.config.powerup, this.config.eos, this.telegram, this.eos_api)
        this.eosio_data = {tel_contract: config.eos.teleportContract, short_net_id: fromHexString(config.eos.netId.substring(0, 8))}
    }

    /**
     * Send sign a teleport. Repeats itself until a defined amount of tries are reached 
     * @param id Teleport id
     * @param signature Signature of this oracle
     * @param tries Already passed tries
     */
    async sendSignAction(id: number, signature: string, tries = 0){
        try{
            // Send transaction
            console.log(`Teleport id ${id}, try to send signature ${tries}.`)
            const result = await this.eos_api.getAPI().transact({
                actions: [{
                    account: this.config.eos.teleportContract,
                    name: 'sign',
                    authorization: [{
                        actor: this.config.eos.oracleAccount,
                        permission: this.config.eos.oraclePermission || 'active',
                    }],
                    data: {
                        oracle_name: this.config.eos.oracleAccount,
                        id,
                        signature
                    },
                }]
            }, {
                blocksBehind: 3,
                expireSeconds: 30,
            })

            // Lend CPU and NET resources if needed
            await sleep(1000)
            await this.rsManager.check(this.eos_api)
        } catch (e) {
            console.error(`\nCaught exception: ${e} \n`)
            let retry = true
            let tooManyFailed = false
            if (e instanceof RpcError){
                if('code' in e.json && 'error' in e.json && 'code' in e.json.error){
                    switch(e.json.error.code){
                        case 3010004:                   // Unauthorized 
                        retry = false
                        break
                        // case 3080001: break          // RAM exceeded
                        case 3080002:                   // NET exceeded
                        console.log('Borrow NET')
                        await this.rsManager.borrow(this.eos_api, false, true)
                        break
                        case 3080004:                   // CPU exceeded
                            console.log('Borrow CPU', e.message)
                            if(e.message.indexOf('estimated CPU time (0 us) is not less than the maximum billable CPU time for the transaction (0 us)') != -1){
                                // Blocked by this endpoint because of too many failed transactions
                                console.log(`Got blocked by ${this.eos_api.getEndpoint()}`)
                                tooManyFailed = true
                            } else {
                                await this.rsManager.borrow(this.eos_api, true, false)
                            }
                        break
                    }
                }
            }
            tries++
            if(tries < this.config.eos.endpoints.length && retry){
                await this.eos_api.nextEndpoint()
                await this.sendSignAction(id, signature, tries)
            } else {
                if(tooManyFailed){
                    this.telegram.logViaBot('Sleep for 24h, because endpoints blocked further transactions')
                    await sleep(24*3600*1000)
                    await this.eos_api.nextEndpoint()
                    await this.sendSignAction(id, signature, tries)
                } else {
                    this.telegram.logError(`Teleport id ${id.toString()}, skip sign action by ${this.config.eos.oracleAccount} on ${this.config.eos.network} ❌\n${String(e)}`)
                }
            }
            return
        }
        console.log(`Teleport id ${id}, successful send sign action. ✔️`)
    }

    /**
     * Get table rows
     * @param lower_bound Start teleport id 
     * @param limit Amount of requested rows 
     * @param json True for entries in json format and false for raw (string) format
     * @returns Teleport table rows result 
     */
    async getTableRows(lower_bound: number, limit: number, json = true){
        let retries = 0
        let teleport_res : GetTableRowsResult | null = null
        let gotTeleport = false
        do{
            if(retries >= 10){   
                throw new Error(`Got no result by endpoint ${this.eos_api.getEndpoint()}.`)
            }
            try{
                retries++
                teleport_res = await this.eos_api.getRPC().get_table_rows({
                    json,
                    code: this.config.eos.teleportContract,
                    scope: this.config.eos.teleportContract,
                    table: 'teleports',
                    lower_bound,
                    limit
                })
            } catch(e){
                console.log(e)
                await this.eos_api.nextEndpoint()
            }
            if(teleport_res == null || 'rows' in teleport_res == false){
                console.log(`Got no teleports. Try ${retries}.`)
            } else {
                gotTeleport = true
            }
        } while(!gotTeleport)
        
        return teleport_res as GetTableRowsResult
    }
          
    /**
     * Serialize the table entry of a teleport 
     * @param teleport Parameters of a teleport table entry  
     * @param logSize Trim the serialized data to this size
     * @returns Serialized data as Uint8Array
     */
    static serializeLogData_v1(teleport: {id: number, time: number, account: string, quantity: string, chain_id: number, eth_address: string}, logSize: number){
        // Serialize the values
        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        })
        sb.pushNumberAsUint64(teleport.id)
        sb.pushUint32(teleport.time)
        sb.pushName(teleport.account)
        sb.pushAsset(teleport.quantity)
        sb.push(teleport.chain_id)
        sb.pushArray(fromHexString(teleport.eth_address))
        return sb.array.slice(0, logSize)
    }
    
    /**
     * Serialize the table entry of a teleport 
     * @param teleport Parameters of a teleport table entry  
     * @param logSize Trim the serialized data to this size
     * @returns Serialized data as Uint8Array
     */
    static serializeLogData_v2(eosio_chain_data : EOSIO_Chain_Data, teleport: {id: number, time: number, account: string, quantity: string, chain_id: number, eth_address: string}, logSize: number){
        // Serialize the values
        const sb = new Serialize.SerialBuffer({
            textEncoder: new TextEncoder,
            textDecoder: new TextDecoder
        })
        sb.pushNumberAsUint64(teleport.id)
        sb.pushUint32(teleport.time)
        sb.pushName(teleport.account)
        sb.pushAsset(teleport.quantity)
        sb.push(teleport.chain_id)
        sb.pushName(eosio_chain_data.tel_contract)
        sb.pushUint8ArrayChecked(eosio_chain_data.short_net_id, 4)
        sb.pushArray(fromHexString(teleport.eth_address))
        return sb.array.slice(0, logSize)
    }

    /**
     * Get signature for teleport data
     * @param logData Serialized teleport table entry
     * @returns Signature
     */
    static async signTeleport(logData: Uint8Array, privateKey: string){
        // Sha3 of the serilized values. Note: The same result is one parameter for the claim function on the eth chain
        const logDataKeccak = keccak(Buffer.from(logData))
        
        // console.log('logData', Buffer.from(logData).toString('hex'))
        // console.log('logDataKeccak', logDataKeccak.toString('hex'))
        
        // Sign the sha3 hash
        const ethPriKey = Buffer.from(privateKey, "hex")
        const sig = ecsign(logDataKeccak, ethPriKey)
        toRpcSig(sig.v, sig.r, sig.s)
        return toRpcSig(sig.v, sig.r, sig.s)
    }
    
    /**
     * Get an amount of teleport entries as json, severall times from different endpoints for verification and the lowest amount of entries provided over all used endpoints  
     * @param request.lowerId Get endpoints beginning by this teleport id number
     * @param request.amount Amount of requested teleports
     * @returns teleport array in json format, array of teleport arrays in row format and minimum amount of provided entries
     */
    async getNextTeleports(request: {lowerId: number, amount: number}){
        // Get the next teleports in json format
        const chain_data = await this.getTableRows(request.lowerId, request.amount, true) as GetTableRowsResult
        let lowest_amount = chain_data.rows.length
        
        // Get the teleports in raw format from other endpoints for verification
        let verify_data : Array<Array<string>> = []
        if(lowest_amount > 0){
            const initialEndpoint = this.eos_api.getEndpoint()
            for(let i = 1; i < this.config.eos.epVerifications; i++){
                await this.eos_api.nextEndpoint()
                const vData = (await this.getTableRows(request.lowerId, request.amount, false) as GetTableRowsResult).rows as Array<string>
                verify_data.push(vData)
                if(initialEndpoint == this.eos_api.getEndpoint()){
                    throw('No available endpoints for verification. ⛔')
                }
                // Handle only to the lowest amount of entries  
                if(lowest_amount > vData.length){
                    lowest_amount = vData.length 
                }
            }
        }
        return {chain_data, verify_data, lowest_amount}
    }
    
    /**
     * Update the current block time and the last irreversible block time
     */
    async updateTimes(){
        let minIrrTime = this.irreversible_time
        // let minCurrentTimeMs = this.current_block_time
        let lowestIrr: number | undefined = undefined
        let epStart = this.eos_api.getEndpoint()
        let verifications = 0
        do{
            try{
                // Get current info
                let info = await this.eos_api.getRPC().get_info()
                let irr_time : number
                
                if(info.last_irreversible_block_time){
                    // Get last irreversible block time if available
                    irr_time = new Date(info.last_irreversible_block_time + 'Z').getTime()
                } else if (info.last_irreversible_block_num){
                    // Get last irreversible block time from last irreversible block
                    let irr_block = await this.eos_api.getRPC().get_block(info.last_irreversible_block_num)
                    irr_time = new Date(irr_block.timestamp + 'Z').getTime()                    
                } else {
                    throw('No time parameter given by ' + this.eos_api.getEndpoint())
                }

                if(typeof irr_time == 'number'){
                    // Convert to full seconds
                    let t = Math.floor(irr_time / 1000)
                    if(t < minIrrTime){
                        throw(`Irreversible time is lower than possible, occurred by using ${this.eos_api.getEndpoint()}`)
                    } else if(lowestIrr === undefined || t < lowestIrr) {
                        // New lowest possible irreversible time
                        lowestIrr = t
                    }
                } else {
                    throw(`Time parameter is not a number, occurred by using ${this.eos_api.getEndpoint()}`)
                }
                verifications++
            } catch(e) {
                console.log('⚡️ ' + e)
                // Get next endpoint and check if all endpoints are already checked
                await this.eos_api.nextEndpoint()
                if(epStart == this.eos_api.getEndpoint()){
                    throw('Could not get last irreversible block time from any endpoint. ⛔')
                }
            }
        } while(verifications < this.config.eos.epVerifications)

        // Set new time values
        if(lowestIrr){
            this.irreversible_time = lowestIrr
        }
    }

    /**
     * Sign all teleports 
     * @param signProcessData.lowerId Id of teleport to start from. Will be updated by the handled amount of teleports.
     * @param signProcessData.amount Amount of requested teleports
     */
    async signAllTeleportsUntilNow(signProcessData: {lowerId: number, amount: number}){
        
        let waitForIrr = 0
        let lastHandledId = signProcessData.lowerId

        // Get next teleports
        let {chain_data, verify_data, lowest_amount} = await this.getNextTeleports(signProcessData)
        
        for(let rowIndex = 0; rowIndex < lowest_amount; rowIndex++) {
            const item = chain_data.rows[rowIndex] as TeleportTableEntry
            
            // Check if already claimed anf if the required amount of signes is already reached
            if(item.claimed){
                console.log(`Teleport id ${item.id}, is already claimed. ✔️`)
                if(!this.force){
                    lastHandledId = item.id + 1
                    continue
                }
            }
            // Check if the required amount of signes is already reached
            if(item.oracles.length >= this.config.confirmations){
                console.log(`Teleport id ${item.id}, has already sufficient confirmations. ✔️`)
                if(!this.force){
                    lastHandledId = item.id + 1
                    continue
                }
            }
            // Check if this oracle account has already signed
            if(item.oracles.find(oracle => oracle == this.config.eos.oracleAccount) != undefined){
                console.log(`Teleport id ${item.id}, has already signed. ✔️`)
                lastHandledId = item.id + 1
                continue
            }
            
            // Serialize the teleport table entry
            let logData : Uint8Array
            let verifyLogData = EosOracle.serializeLogData_v1(item, 69)
            const verifyLogDataHex = toHexString(verifyLogData)

            // Verify serialization
            let isVerifyed = true
            for(let i = 0; i < this.config.eos.epVerifications - 1; i++){ 
                if(verifyLogDataHex != verify_data[i][rowIndex].slice(0, verifyLogData.length * 2)){
                    console.error(`Verification failed by ${this.eos_api.getEndpoint()}. ⚠️`)
                    isVerifyed = false
                }
                // console.log(`Teleport id ${item.id}, verified ${i + 1} times`)
            }

            // Get serialized data for signing
            if(typeof this.config.version != 'number' || this.config.version < 2){
                logData = verifyLogData
            } else {
                logData = EosOracle.serializeLogData_v2(this.eosio_data, item, 81)
            }

            // Check time
            if(item.time > this.irreversible_time){
                await this.updateTimes()
                if(item.time > this.irreversible_time){
                    waitForIrr = item.time - this.irreversible_time
                    lastHandledId = item.id
                    break
                }
            }

            if(!isVerifyed){
                this.telegram.logError(`Teleport id ${TgM.sToMd(item.id.toString())}, skip this one by *${TgM.sToMd(this.config.eos.oracleAccount)}* on *${TgM.sToMd(this.config.eos.network)}* ❌`, true, true)
            } else {
                // Sign the serialized teleport
                const signature = await EosOracle.signTeleport(logData, this.config.eth.privateKey)
                
                // Send signature to eosio chain
                await this.sendSignAction(item.id, signature)
            }
            lastHandledId = item.id + 1
        }
        
        // Set and store the next teleport id
        if(lastHandledId != signProcessData.lowerId){
            await save_number_to_file(lastHandledId, this.id_file_name)
            signProcessData.lowerId = lastHandledId
        }

        // Get the next teleports
        if(this.running){
            if(waitForIrr > 0){
                // Wait maximal 180 seconds
                if(waitForIrr > EosOracle.maxWait) {
                    waitForIrr = EosOracle.maxWait
                }
                console.log(`Wait ${waitForIrr} seconds until teleport id ${signProcessData.lowerId} is irreversible.`)
                await WaitWithAnimation(waitForIrr)
                await this.signAllTeleportsUntilNow(signProcessData)
            }
            else if(chain_data.more == true){
                await this.signAllTeleportsUntilNow(signProcessData)
            }
        }
    }

    /**
     * Run the process of signing eosio chain teleports to eth chain
     * @param id Teleport id to start from
     * @param requestAmount Amount of requested teleports per request
     */
    async run(id: undefined | number = undefined, requestAmount = 100, waitCycle = EosOracle.maxWait){
        // Get last id from file if it is undefined
        if(id === undefined){
            try{
                id = await load_number_from_file(this.id_file_name) - 100 // Minus 100 for safety
                if(id < 0){
                    id = 0
                }
            } catch(e){
                id = 0
            }
        }

        await this.telegram.logViaBot(`Starting *${TgM.sToMd(this.config.eos.network)}* oracle with *${TgM.sToMd(this.config.eos.oracleAccount)}* beginning by *id ${TgM.sToMd(id.toString())}* 🏃`, true, true)

        // Create an object to change the current id on each run
        this.running = true
        try{
            const signProcessData = {lowerId: id, amount: requestAmount}
            while(this.running){
                await this.eos_api.nextEndpoint()
                await this.updateTimes()
                await this.rsManager.checkBorrowTimeOut(this.eos_api)
                await this.signAllTeleportsUntilNow(signProcessData)
                await WaitWithAnimation(waitCycle, 'All available teleports signed')
            }
        } catch (e){
            await this.telegram.logError(`⚡️ by ${this.config.eos.oracleAccount} on ${this.config.eos.network} \n${String(e)}`)
        }
        await this.telegram.logViaBot(`Thread closed of *${TgM.sToMd(this.config.eos.network)}* oracle with *${TgM.sToMd(this.config.eos.oracleAccount)}* 💀`, true, true)
        if(this.telegram.isTelegram()){
            await sleep(5000)   // Wait some seconds to finsih the sending of telegram messages for real
        }
    }
}

// Handle params from console
const argv = yargs
    .version().alias('version', 'v')
    .option('id', {
        alias: 'n',
        description: 'Teleport id to start from',
        type: 'number'
    })
    .option('amount', {
        alias: 'a',
        description: 'Amount of handled teleports per requests',
        type: 'number'
    })
    .option('signs', {
        alias: 's',
        description: 'Amount of signatures until this oracle will sign too',
        type: 'number'
    })
    .option('waiter', {
        alias: 'w',
        description: 'Seconds to wait after finishing all current teleports',
        type: 'number'
    })
    .option('force', {
        description: 'Force signing, even when it is already completed or signed by other oracles',
        type: 'boolean'
    })
    .option('config', {
        alias: 'c',
        description: 'Path of config file',
        type: 'string'
    })
    .help().alias('help', 'h').argv as {
        id: number,
        amount: number,
        signs: number,
        waiter: number,
        force: boolean,
        config: string,
    }

// Load config and set title
const config_path = argv.config || process.env['CONFIG'] || './config'
process.title = `oracle-eos ${config_path}`
const configFile : ConfigType = require(config_path)

// Get time to wait for each round by config file or comsole parameters
let waitCycle : undefined | number = undefined
if(typeof configFile.eos.waitCycle == 'number'){
    waitCycle = configFile.eos.waitCycle
}
if(argv.waiter) {
    waitCycle = argv.waiter 
}

// Configure eosjs specific propperties
const signatureProvider = new JsSignatureProvider([configFile.eos.privateKey])
const eosOracle = new EosOracle(configFile, signatureProvider, argv.force)

// Run the process
eosOracle.run(argv.id, argv.amount, waitCycle)

