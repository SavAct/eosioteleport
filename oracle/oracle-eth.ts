/*
    This oracle listens to the ethereum blockchain for `Teleport` and `Claimed` events.

    When an `Teleport` event is received, it will call the `received` action on the EOSIO chain.
    On receiving a `Claimed` event, it will call the `claimed` action on the EOSIO chain.
 */

process.env.NTBA_FIX_319 = '1' // Needed to disable TelegramBot warning
import fs from 'fs'
import { ethers } from 'ethers'
import yargs from 'yargs'
import { ConfigType, eosio_claim_data, eosio_teleport_data } from './CommonTypes'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'
import { TransactResult } from 'eosjs/dist/eosjs-api-interfaces'
import { EosApi, EthApi } from './EndpointSwitcher'
import {sleep, hexToString, WaitWithAnimation, assetdataToString, stringToAsset, Asset} from '../scripts/helpers'
import { RpcError } from 'eosjs'
import { TelegramMessenger } from './TelegramMesseger'
import { ResourcesManager } from './ResourcenManager'
import { Action } from 'eosjs/dist/eosjs-serialize'

type EthDataConfig = {precision: number, symbol: string, eos:{oracleAccount: string, id?: number, netId: string}}

interface LogEvent {
    decode: Array<string>,
    topic: string,
}

class EthOracle {
    static version_v1 = {
        claimed : {
            // Claimed(uint64,address,uint256)
            decode: ['uint64','address','uint256'],
            topic: '0xf20fc6923b8057dd0c3b606483fcaa038229bb36ebc35a0040e3eaa39cf97b17',
        },
        teleport : {
            // Teleport(address,string,uint256,uint256)
            decode: ['string','uint256','uint256'],         // Address is indexed
            topic: '0x622824274e0937ee319b036740cd0887131781bc2032b47eac3e88a1be17f5d5',
        }
    }
    static version_v2 = {
        claimed : {
            // Claimed(bytes32,address,uint256)
            decode: ['bytes32','address','uint256'],
            topic: '0x0508a8b4117d9a7b3d8f5895f6413e61b4f9a2df35afbfb41e78d0ecfff1843f',
        },
        teleport : {
            // Teleport(address,string,uint256)
            decode: ['string','uint256'],                   // Address is indexed
            topic: '0xc8cee5634900c8bdd1ce6ab2e4fdac4d0c4cb5a3cce1c6d5f447cf84a3ddf414',
        }
    }
    
    private version : number
    private claimed_logEvent : LogEvent
    private teleport_logEvent : LogEvent
    public running = false
    static MIN_BLOCKS_TO_WAIT = 5
    private blocksToWait : number
    private blocks_file_name : string
    private eos_api: EosApi
    private eth_api: EthApi
    private minTrySend = 3
    
    private telegram: TelegramMessenger
    private rsManager: ResourcesManager
    private blocksPerRequest = 100
    
    constructor(private config: ConfigType, private signatureProvider: JsSignatureProvider){
        
        // Standardise the net id
        this.config.eos.netId = this.config.eos.netId.toLowerCase()
        if(this.config.eos.netId[1] == 'x'){
            this.config.eos.netId = this.config.eos.netId.substring(2)
        }
        
        // Set further initial data
        this.blocksToWait = typeof config.eth.blocksToWait == 'number' && config.eth.blocksToWait > EthOracle.MIN_BLOCKS_TO_WAIT? config.eth.blocksToWait : EthOracle.MIN_BLOCKS_TO_WAIT
        this.blocks_file_name = `.oracle_${configFile.eth.network}_block-${configFile.eth.oracleAccount}`
        this.minTrySend = Math.max(this.minTrySend, config.eos.endpoints.length)
        
        // Initialize the telegram bot
        this.telegram = new TelegramMessenger(config.telegram)

        // Create interfaces for eosio and eth chains
        this.eos_api = new EosApi(this.config.eos.netId, this.config.eos.endpoints, this.signatureProvider)
        this.eth_api = new EthApi(this.config.eth.netId, this.config.eth.endpoints)
        
        // Initialize the lending options
        this.rsManager = new ResourcesManager(this.config.powerup, this.config.eos, this.telegram, this.eos_api, false)

        // Set the version specific data
        this.version = 0
        switch(this.config.version){
            case 2: this.version = 2
                this.claimed_logEvent = EthOracle.version_v2.claimed
                this.teleport_logEvent = EthOracle.version_v2.teleport
                break;
            case 1: this.version = 1
            case 0:
            default:
                this.claimed_logEvent = EthOracle.version_v1.claimed
                this.teleport_logEvent = EthOracle.version_v1.teleport
        }

        if(config.eth.blocksPerRequest){
            if(config.eth.blocksPerRequest > 200){
                console.log('Attention, eth nodes usually do not accept more than 200 blocks per request');
            }
            this.blocksPerRequest = config.eth.blocksPerRequest
        }
    }

    /**
     * Get object of the data of an "claimed"-event on eth chain
     * @param data "claimed"-event data
     * @param config Contains information of precision and symbol of the token as well as the oracle name of this contract 
     * @returns 
     */
    static extractEthClaimedData(version: number, data: ethers.utils.Result, config: EthDataConfig): eosio_claim_data | false {
        if(version >= 2){
            let chainNet = data[0].toString();
            if(chainNet.length < 10){
                console.log('Wrong length of net id', chainNet);
                return false
            }
            chainNet = chainNet.substring(2, 10).toLowerCase()
            if(config.eos.netId.substring(0, 8) != chainNet){
                console.log(`Found teleport with other net id ${chainNet} is not queal to ${config.eos.netId.substring(0, 8)}`);
                return false
            }

            const to_eth = data[1].replace('0x', '') + '000000000000000000000000'

            let combiparam = data[2].toHexString()
            if(combiparam.length > 66){
                console.log('Wrong combined parameters', combiparam)
                return false
            }
            const {chain_id, id, quantity} = EthOracle.getLogTelParams(combiparam.substring(2).padStart(64, '0')) 
            
            if(chain_id != config.eos.id){
                console.log('Wrong chain id', chain_id)
                return false
            }
                      
            return {oracle_name: config.eos.oracleAccount, id, to_eth, quantity }
        } else {
            const id = BigInt(data[0].toString())
            const to_eth = data[1].replace('0x', '') + '000000000000000000000000'
            const amount = BigInt(data[2].toString())
            const quantity = assetdataToString(amount, config.symbol, config.precision)
            return { oracle_name: config.eos.oracleAccount, id, to_eth, quantity }
        }
    }

    static getLogTelParams(hexString: string) {
        const chain_id = Number('0x' + hexString.slice(14, 16))
        const id = BigInt('0x' + hexString.substring(16,32))
        const symbol_and_precision = hexString.substring(32, 48)
        const amount = BigInt('0x' + hexString.substring(48))
        const symbolhex = symbol_and_precision.substring(2)
        let symbol = hexToString(symbolhex)
        const precision = Number('0x' + symbol_and_precision.substring(0, 2))
        const quantity = assetdataToString(amount, symbol, precision)
        return { chain_id, id, quantity, amount }
    }
    
    /**
     * Get object of the data of an "teleport"-event on eth chain
     * @param data "teleport"-event data
     * @param config Contains information of precision and symbol of the token as well as the oracle name of this contract 
     * @returns 
     */
    static extractEthTeleportData(version: number, data: ethers.utils.Result, transactionHash: string, config: EthDataConfig): eosio_teleport_data | false{        
        const txid = transactionHash.replace(/^0x/, '')
        if(version >= 2){
            const to = data[0]

            let combiparam = data[1].toHexString()
            if(combiparam.length > 66){
                console.log('Wrong combined parameters', combiparam)
                return false
            }
            const {chain_id, id, quantity, amount} = EthOracle.getLogTelParams(combiparam.substring(2).padStart(64, '0')) 
            if(chain_id != config.eos.id){
                console.log('Wrong chain id', chain_id)
                return false
            }
            
            if (amount == BigInt(0)) {
                console.log('Tokens are less than or equal to 0')
                return false
            }

            return { chain_id, confirmed: true, quantity, to, oracle_name: config.eos.oracleAccount, index: id, ref: txid }
        } else {
            const to = data[0]
            const amount = BigInt(data[1].toString())
            if (amount == BigInt(0)) {
                throw new Error('Tokens are less than or equal to 0')
            }
            const quantity = assetdataToString(amount, config.symbol, config.precision)
            let chain_id = data[2].toNumber() as number
            return { chain_id, confirmed: true, quantity, to, oracle_name: config.eos.oracleAccount, ref: txid }
        }      
    }

    /**
     * Wait until an event got enough confirmations and validations by other endpoints
     * @param entry.transactionHash Hash of the transaction which contains the event
     * @param entry.data Event data in raw format
     * @returns False if there are not enough endpoints which validate the event
     */
    async await_confirmation(entry:{ transactionHash: string, data: string}) {
        let validators = new Set()
        if(this.eth_api.get_EndpointAmount() < this.config.eth.epVerifications){
            throw Error('Not enough eth endpoints for validation ❌')
        }

        let firstEp = undefined
        while (true) {
            try{
                const receipt = await this.eth_api.getProvider().getTransactionReceipt(entry.transactionHash)
                
                if(receipt){
                    // Check amount of block confirmations
                    const overConfs = receipt.confirmations - this.blocksToWait
                    if (overConfs > 0) {
                        let ep = this.eth_api.getEndpoint()
                        validators.add(ep)
                        
                        if(receipt.logs.find(e=>{ return e.data == entry.data}) == undefined){
                            console.log(`Event data of ${entry.transactionHash} was not found by ${ep} ❌`)
                            return false
                        }

                        console.log(`Cofirmations ${receipt.confirmations} by ${ep}`)
    
                        if(validators.size >= this.config.eth.epVerifications){
                            console.log(`TX ${entry.transactionHash} has ${receipt.confirmations} confirmations`)
                            return true
                        }
    
                        // If one endpoint reaches one more confirmations as needed, check each endpoint again and thow an error if they still not confirm   
                        if(overConfs > 1){
                            if(firstEp == undefined){
                                firstEp = ep
                            } else if(firstEp == ep){
                                console.error(`Verification failed, only ${validators.size} eth endpoints verified the transaction ${entry.transactionHash} ❌`);
                                return false
                            }
                            // Do not sleep to check all other endpoints after reaching one more confirmation than needed
                        } else {
                            // Sleep one second to check other endpoints if the confirmation amount is just reached
                            await sleep(1000)
                        }
                    }
                } else {
                    await sleep(10000)
                }
            } catch (e) {
                console.error('Error on get transaction receipt', e);
                await sleep(1000)
            }
            await this.eth_api.nextEndpoint()
        }
    }

    static async save_block_to_file(block_num: number, blocks_file: string){
        fs.writeFileSync(blocks_file, block_num.toString())
    }

    /**
     * Check for "claimed" events and store them on eosio chain
     * @param from_block Block number to start looking for events
     * @param to_block Block number to end looking for events
     * @param trxBroadcast False if the transaction should not be broadcasted (not submitted to the block chain)
     */
    async process_claimed(from_block: number, to_block: number, trxBroadcast: boolean = true) {
        // Check claimed events on eth chain
        const query = {
            fromBlock: from_block,
            toBlock: to_block,
            address: this.config.eth.teleportContract,
            topics: [this.claimed_logEvent.topic],
        }
        const res = await this.eth_api.getProvider().getLogs(query)

        // Mark each claimed event on eosio chain as claimed
        for await (const entry of res) {
            // Extract data from eth claimed event
            const decodedData = ethers.utils.defaultAbiCoder.decode(this.claimed_logEvent.decode, entry.data)
            const eosioData = EthOracle.extractEthClaimedData(this.version, decodedData, this.config)

            // When teleport does not refer to this eosio chain
            if(eosioData === false){
                console.log('Continue');
                continue
            }

            // Wait for confirmation of each transaction before continuing
            if(!await this.await_confirmation(entry)){
                console.log(`Skip claimed event with ${eosioData.to_eth} as recipient and the id ${eosioData.id}`)
                continue
            }

            // Continue this event if it was marked as removed
            if(entry.removed){
                this.telegram.logError(`Claimed event with trx hash ${entry.transactionHash} got removed and will be skipped by ${this.config.eos.oracleAccount} on ${this.config.eth.network} ❌`)
                continue
            }

            // Create action
            const actions = [{
                account: this.config.eos.teleportContract,
                name: 'claimed',
                authorization: [{
                    actor: this.config.eos.oracleAccount,
                    permission: this.config.eos.oraclePermission || 'active',
                }],
                data: eosioData,
            }]
        
            // Send transaction on eosio chain
            const eos_res = await this.sendTransaction(actions, trxBroadcast)
            if(eos_res === false){
                this.telegram.logError(`Skip sending claimed of id ${eosioData.id} to eosio chain by ${this.config.eos.oracleAccount} from ${this.config.eth.network} ❌`)
            } else if(eos_res === true){
                console.log(`Id ${eosioData.id} is already claimed, account 0x${eosioData.to_eth.substring(0, 40)}, quantity ${eosioData.quantity} ✔️`)
            } else {
                console.log(`Send claimed of id ${eosioData.id}, account 0x${eosioData.to_eth.substring(0, 40)}, quantity ${eosioData.quantity
                }. EOSIO blocknumber ${eos_res.processed.block_num} and trx id ${eos_res.transaction_id} ✔️`);
            }
        }
    }

    /**
     * Send transaction to EOSIO chain
     * @param actions EOSIO transaction actions
     * @param trxBroadcast Boolean to broadcast a transaction
     * @returns False if it fails, true if a transaction was already marked as claimed or the object of the transaction result
     */
    async sendTransaction(actions: Action[], trxBroadcast: boolean = true){
        let tooManyFailed = false
        for(let tries = 0; tries < this.minTrySend; tries++){
            try {
                // Send transaction
                const eos_res = await this.eos_api.getAPI().transact({ actions }, { 
                    blocksBehind: 3, 
                    expireSeconds: 30, 
                    broadcast: trxBroadcast 
                }) as TransactResult
                // Lend CPU and NET resources if needed
                await sleep(1000)
                await this.rsManager.check(this.eos_api)        
                return eos_res
            } catch (e: any) {
                let error : string = 'Unkwon error'
                if(e.message){
                    // Get error message
                    const s = e.message.indexOf(':') + 1
                    if(s > 0 && s < e.message.length){
                        error = e.message.substring(s)
                    } else {
                        error = e.message
                    }
                    // Check if the error appears because the transaction is already claimed or approved
                    if (error.indexOf('Already marked as claimed') > -1 || error.indexOf('Oracle has already approved') > -1 || error.indexOf('already completed') > -1) {
                        return true
                    }
                }
                
                console.error(`Error while sending transaction to ${actions.length > 0? actions[0].account: 'unkown'} on ${this.config.eos.network} chain with ${this.eos_api.getEndpoint()}: ${error} ❌\n${String(e)}`)                

                if (e instanceof RpcError){
                    if('code' in e.json && 'error' in e.json && 'code' in e.json.error){
                        switch(e.json.error.code){
                            // case 3010004: break          // Unauthorized
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

                await this.eos_api.nextEndpoint()
                await sleep(1000)
            }
        }
        if(tooManyFailed){
            this.telegram.logViaBot('Sleep for 24h, because endpoints blocked further transactions')
            await sleep(24*3600*1000)
        }
        return false
    }

    /**
     * Check for "teleport" events and store them on eosio chain
     * @param from_block Block number to start looking for events
     * @param to_block Block number to end looking for events
     * @param trxBroadcast False if the transaction should not be broadcasted (not submitted to the block chain)
     */
    async process_teleported(from_block: number, to_block: number, trxBroadcast: boolean = true){
        // Check teleport events on eth chain
        const query = {
          fromBlock: from_block,
          toBlock: to_block,
          address: this.config.eth.teleportContract,
          topics: [this.teleport_logEvent.topic],
        }
        const res = await this.eth_api.getProvider().getLogs(query)
      
        // Confirm each teleport event on eosio chain
        for await (const entry of res) {
            // Extract data from teleport eth event
            const decodedData = ethers.utils.defaultAbiCoder.decode(this.teleport_logEvent.decode, entry.data)
            const eosioData = EthOracle.extractEthTeleportData(this.version, decodedData, entry.transactionHash, this.config)
            if(eosioData === false){
                console.log('Continue');
                continue
            }            

            // Check id is equal to recipient chain
            if(this.config.eos.id !== undefined && eosioData.chain_id !== Number(this.config.eos.id)){
                console.log(`Skip teleport event with ${eosioData.to} as recipient and ref of ${eosioData.ref} because the chain id ${eosioData.chain_id} referes to another blockchain.`)
                continue
            }

            // Wait for confirmation of each transaction before continuing
            if(!await this.await_confirmation(entry)){
                console.log(`Skip teleport event with ${eosioData.to} as recipient and ref of ${eosioData.ref}`)
                continue
            }

            // Continue this event if it was marked as removed
            if(entry.removed){
                console.log(`Teleport with trx hash ${entry.transactionHash} got removed and will be skipped ❌`)
                continue
            }

            // Set the id as the id of the sender chain
            if(this.version != 0 || this.config.eth.id !== undefined){
                eosioData.chain_id = Number(this.config.eth.id)
            }

            // Create action
            const actions = [{
                account: this.config.eos.teleportContract,
                name: 'received',
                authorization: [{
                  actor: this.config.eos.oracleAccount,
                  permission: this.config.eos.oraclePermission || 'active',
                }],
                data: eosioData,
            }]
        
            // Send transaction on eosio chain
            const eos_res = await this.sendTransaction(actions, trxBroadcast)
            if(eos_res === false){
                this.telegram.logError(`Skip sending teleport to ${eosioData.to} with ref ${eosioData.ref} and quantity of ${eosioData.quantity} ❌`)
            } else if(eos_res === true){
                console.log(`Oracle has already approved teleport to ${eosioData.to} with ref ${eosioData.ref} and quantity of ${eosioData.quantity} ✔️`)
            } else {
                console.log(`Send teleport to ${eosioData.to} with ref ${eosioData.ref} and quantity of ${eosioData.quantity
                }. EOSIO blocknumber ${eos_res.processed.block_num} and trx id ${eos_res.transaction_id} ✔️`);
            }
        }
    }

    /**
     * Loads a block number from a saved file if one exists or throws an error.
     * @returns a saved block number from a file
     */
    static async load_block_number_from_file(blocks_file: string) {
        //   let block_number: string | number = 'latest'
        if (!fs.existsSync(blocks_file))
            throw new Error('block file does not exist.')

        const file_contents = fs.readFileSync(blocks_file).toString()
        if (!file_contents) throw new Error('No blocks file')

        const block_number = parseInt(file_contents)
        if (isNaN(block_number)) throw new Error('No block number in file.')

        return block_number
    }

    /**
     * Get latest block of eth blockchain
     * @returns latest block number
     */
    private async getLatestBlock() {
       let tries = 0
       while(true) {
           try{
               const block = await this.eth_api.getProvider().getBlock('latest')
               return block.number
           } catch(e){
               if(tries >= this.eth_api.get_EndpointAmount()){
                   console.log('Could not get latest block by any eth endpoint ❌')
                   return undefined
               } else {
                   console.error(`Could not get latest block with ${this.eth_api.getEndpoint()} ❌`)
                   await this.eth_api.nextEndpoint()
                   console.log(`Try ${this.eth_api.getEndpoint()} in a second...`)
                   tries++                   
                   await sleep(1000)
               }
           }
       }
    }

    /**
     * Run the process of checking the eth chain for teleports and claims and store the state on ethe eosio chain
     * @param start_ref Block number to start from. String 'latest' to start from the latest block in block number file
     * @param trxBroadcast False if transactions should not be broadcasted (not submitted to the block chain)
     */
    async run(start_ref: 'latest' | number | undefined, trxBroadcast: boolean = true, waitCycle = 30){
        this.telegram.logViaBot(`Starting *${this.config.eth.network}* oracle with *${this.config.eos.oracleAccount}* and ${this.config.eth.oracleAccount} 🏃`, true)
        let from_block: number | undefined
        this.running = true
        try{
            await this.eth_api.nextEndpoint()
            await this.eos_api.nextEndpoint()
            let tries = 0
            while (this.running) {
                try {
                    // Get latest block from chain
                    const latest_block = await this.getLatestBlock()
                    if(typeof latest_block != 'number'){
                        console.error('Latest block number is not a number', latest_block)
                        return
                    }

                    // Get block number to start from on this cycle
                    if (from_block == undefined) {
                        if(start_ref === 'latest'){
                            from_block = latest_block - 100     // go back 100 blocks from latest
                            console.log('Start 100 blocks before the latest block.')
                        } else if (typeof start_ref === 'number') {
                            from_block = start_ref
                        } else {
                            try {
                                from_block = await EthOracle.load_block_number_from_file(this.blocks_file_name)
                                from_block -= 50                     // for fresh start go back 50 blocks
                                if(this.config.eth.genesisBlock && this.config.eth.genesisBlock > from_block){
                                    from_block = this.config.eth.genesisBlock
                                    console.log('Genesis block is higher. Start by genesis block.')
                                } else {
                                    console.log(`Starting from saved block with additional previous 50 blocks for safety: ${from_block}.`)
                                }
                            } catch (err) {
                                console.log('Could not get block from file ❌')
                                if(this.config.eth.genesisBlock){
                                    from_block = this.config.eth.genesisBlock
                                    console.log('Start by genesis block.')
                                } else {
                                    from_block = latest_block - 100     // go back 100 blocks from latest
                                    console.log('Start 100 blocks before the latest block.')
                                }
                            }
                        }
                    }
                    if(from_block < 0){
                        from_block = 0
                    }

                    // Get the last block number until teleports should be checked on this cycle
                    let to_block = Math.min(from_block + this.blocksPerRequest, latest_block)

                    if (from_block <= to_block) {
                        console.log(`Getting events from block ${from_block} to ${to_block}`)
                        await this.process_claimed(from_block, to_block, trxBroadcast)
                        await this.process_teleported(from_block, to_block, trxBroadcast)
                        from_block = to_block                                               // In next round the current to block is the from block
                        await EthOracle.save_block_to_file(to_block, this.blocks_file_name) // Save last block received
                    } else {
                        console.log(`⚡️ From block ${from_block} is higher than to block ${to_block}`)
                        await sleep(10000)
                    }
                    if (latest_block - from_block <= 1000) {
                        await WaitWithAnimation(waitCycle, 'Wait for new blocks...')
                    } else {
                        console.log(`Latest block is ${latest_block}. Not waiting...`)
                    }
                    tries = 0
                } catch (e: any) {
                    console.error('⚡️ ' + e.message)
                    tries++
                    if(tries < 12){
                        console.error('Try again in 5 seconds')
                        await sleep(5000)
                    } else {
                        throw(e.message)
                    }
                }

                // Select the next endpoint to distribute the requests
                await this.eos_api.nextEndpoint()
            }
        } catch(e){
            await this.telegram.logError(`⚡️ by ${this.config.eos.oracleAccount} on ${this.config.eth.network}. ${String(e)}`)
        }
        await this.telegram.logViaBot(`Thread closed of *${this.config.eth.network}* oracle with *${this.config.eos.oracleAccount}* and ${this.config.eth.oracleAccount} 💀`, true)
        if(this.telegram.isTelegram()){
            await sleep(5000)   // Wait some seconds to finsih the sending of telegram messages for real
        }
    }
}

// Handle params from console
const argv = yargs
    .version().alias('version', 'v')
    .option('block', {
        alias: 'b',
        description: 'Block number to start scanning from',
    })
    .option('waiter', {
        alias: 'w',
        description: 'Seconds to wait after finishing all current teleports',
        type: 'number'
    })
    .option('config', {
        alias: 'c',
        description: 'Path of config file',
        type: 'string'
    })
    .option('broadcast', {
      alias: 'o',
      type: 'boolean',
      description: 'boolean to determine if transactions should be submitted to blockchain',
      default: true,
    })
    .help().alias('help', 'h').argv as {
        block: number | string,
        waiter: number,
        config: string,
        broadcast: boolean,
    }
    
// Load config and set title
const config_path = argv.config || process.env['CONFIG'] || './config'
process.title = `oracle-eth ${config_path}`
const configFile : ConfigType = require(config_path)

// Check and set start parameters
let startRef: 'latest' | number | undefined = undefined 
if(typeof argv.block == 'number' || argv.block == 'latest') {
    startRef = argv.block
} else if(process.env['START_BLOCK']) {
    const start_block_env = parseInt(process.env['START_BLOCK'])
    if(isNaN(start_block_env)) {
        console.error('You must supply start block as an integer in env')
        process.exit(1)
    }
    startRef = start_block_env
}
if(configFile.eos.epVerifications > configFile.eos.endpoints.length){
    console.error('Error: eosio epVerifications cannot be greater than given amount of endpoints')
    process.exit(1)
}
if(configFile.eth.epVerifications > configFile.eth.endpoints.length){
    console.error('Error: eosio epVerifications cannot be greater than given amount of endpoints')
    process.exit(1)
}
let waitCycle : undefined | number = undefined
if(typeof configFile.eth.waitCycle == 'number'){
    waitCycle = configFile.eth.waitCycle
}
if(argv.waiter) {
    waitCycle = argv.waiter 
}

// Set up the oracle
const eosSigProvider = new JsSignatureProvider([configFile.eos.privateKey])
const ethOracle = new EthOracle(configFile, eosSigProvider)
// Run the process
ethOracle.run(startRef, argv.broadcast, waitCycle)

