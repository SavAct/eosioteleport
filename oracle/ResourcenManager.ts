import { Asset, assetdataToString, sleep, stringToAsset } from '../scripts/helpers'
import { ConfigType, PowerUp } from './CommonTypes'
import { TgM } from './TelegramMesseger'
import { EosApi } from './EndpointSwitcher'
import { TransactResult } from 'eosjs/dist/eosjs-api-interfaces'

interface Ressource {
    available: number
    lastLend: number
}

interface RawResourceState {
    version: number,
    weight: string,
    weight_ratio: string,
    assumed_stake_weight:string,
    initial_weight_ratio:string, 
    target_weight_ratio: string,
    initial_timestamp:string,
    target_timestamp:string,
    exponent:string,
    decay_secs: number,
    min_price: string,
    max_price:string,
    utilization:string,
    adjusted_utilization:string,
    utilization_timestamp:string
}
interface RawPowerUpState{
    version: number,
    net: RawResourceState,
    cpu: RawResourceState
}

export class ResourcesManager {
    // Object to store the remaining system tokens per day
    private dayCalculator : {currentCosts: bigint, fromTime: number, max_payment: Asset} = {
        currentCosts: BigInt(0),
        fromTime: 0,
        max_payment: {amount:BigInt(0), symbol:{name:'', precision:0}}
    }

    private account_name: string = ''
    private permission: string ='active'

    private maxBorrowDuration = (24 * 60 * 60 * 1000) - (30 * 60 * 1000)    // have to be less than 24h

    private cpu : Ressource
    private net : Ressource


    /**
     * 
     * @param config_powerup Config data to buy resources automatically
     * @param eosio Config data of eosio network
     * @param telegram Telegram messenger object
     * @param eos_api EOSIO API object
     */
    constructor(private config_powerup: PowerUp | undefined, private eosio: ConfigType["eos"], private telegram: TgM, eos_api: EosApi){
        if(config_powerup){
            this.account_name = eosio.oracleAccount
            if(eosio.oraclePermission){
                this.permission = eosio.oraclePermission
            }
            
            // Check some config data
            const asset = stringToAsset(config_powerup.max_payment)
            if(asset.amount != BigInt(0) && typeof asset.symbol.precision != 'number' && asset.symbol.name.length > 0){
                throw('Wrong definition of lend.max_payment')
            }
            // Further checks if it is the EOS network
            if(eosio.netId == 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'){
                if(config_powerup.contract != 'eosio'){
                    throw('Wrong powerup contract')
                }
                if(config_powerup.paymenttoken != 'eosio.token'){
                    throw('Wrong system token symbol for powerup')
                }
                if(asset.symbol.name != 'EOS'){
                    throw('Wrong token symbol of powerup.max_payment')
                }
                if(asset.symbol.precision != 4){
                    throw('Wrong token precision of powerup.max_payment')
                }
            }

            this.dayCalculator.max_payment = asset
            
            if(this.config_powerup){
                this.config_powerup.cpu = typeof this.config_powerup.cpu? Number(this.config_powerup.cpu) : 0
                this.config_powerup.net = typeof this.config_powerup.net? Number(this.config_powerup.net) : 0
            }
        }

        // Set the initial last borrowing time. It is in one tenth of the time after the initial start.
        // This prevents the loan of new resources over and over again if the oracle keeps crashing at the beginning.
        const toTenthDuration = Date.now() - Math.round((9 * this.maxBorrowDuration) / 10)
        this.cpu = {
            available: 0,
            lastLend: toTenthDuration
        }
        this.net = {
            available: 0,
            lastLend: toTenthDuration
        }
    }

    public isManager(){
        return this.config_powerup? true : false
    }

    async check(eos_api: EosApi) {
        if(!this.config_powerup){
            return
        }

        // Check if the resources are less than the min amount
        const result = await eos_api.getRPC().get_account(this.account_name) 
        this.cpu.available = result.cpu_limit.available
        this.net.available = result.net_limit.available
        const rentCPU = this.cpu.available < this.config_powerup.min_cpu
        const rentNET = this.net.available < this.config_powerup.min_net

        this.borrow(eos_api, rentCPU, rentNET)
    }

    /**
     * Borrow resources
     * @param eos_api Eosio API
     * @param cpu True to borrow CPU
     * @param net True to borrow NET
     */
    async borrow(eos_api: EosApi, cpu = false, net = false) {
        if(!this.config_powerup){
            return
        }
        if(!cpu && !net){
            return
        }
        const powerup = this.config_powerup
        
        // Get remaining system tokens for the current day
        let max_payment: bigint
        if((Date.now() - this.dayCalculator.fromTime) >= (24*3600000)){
            this.dayCalculator.fromTime = Date.now()
            this.dayCalculator.currentCosts = BigInt(0)
            max_payment = this.dayCalculator.max_payment.amount
        } else {
            max_payment = this.dayCalculator.max_payment.amount - this.dayCalculator.currentCosts
        }
        const symbol = this.dayCalculator.max_payment.symbol
        
        if(max_payment <= 0){
            await this.telegram.logCosts(`🚫 Max tokens per day is not enough to borrow ${cpu? 'CPU ':''}${cpu && net? 'and ':''}${net?'NET ':''} by ${TgM.sToMd(this.account_name)} on ${TgM.sToMd(this.eosio.network)}`, true, true)
            return
        }
        try{
            // Check current system token balance
            const balances = (await eos_api.getRPC().get_currency_balance(this.config_powerup.paymenttoken, this.account_name, this.dayCalculator.max_payment.symbol.name))
            if(balances.length == 0){
                throw 'Account has no system token entry'
            }
            const balance = balances[0]
            const assetBefore = stringToAsset(balance)
            if(assetBefore.symbol.name != this.dayCalculator.max_payment.symbol.name){
                throw 'Balance has wrong symbol'
            }
            if(assetBefore.amount == BigInt(0)){
                throw 'No more system tokens available'
            }
            if(assetBefore.amount <= this.dayCalculator.max_payment.amount){
                await this.telegram.logCosts(`🚨 System tokens are running out by ${TgM.sToMd(this.account_name)} on ${TgM.sToMd(this.eosio.network)}, ${TgM.sToMd(balance)} remain`, true, true)
            }

            // Get cpu_frac and net_frac for power up
            const cpu_us = typeof powerup.cpu? Number(powerup.cpu) : 0
            const net_kilo_bytes = typeof powerup.net? Math.round(Number(powerup.net) / 1000) : 0
            let fracs = {cpu: 0, net: 0}
            if(powerup.cpu_frac == undefined || powerup.net_frac == undefined){
                fracs = await ResourcesManager.calcFrecs(eos_api, cpu_us, net_kilo_bytes)
            }
            const cpu_frac = cpu? (powerup.cpu_frac !== undefined? powerup.cpu_frac: fracs.cpu): 0
            const net_frac = net? (powerup.net_frac !== undefined? powerup.net_frac: fracs.net) : 0

            // Send transaction
            const action = {
                account: this.config_powerup.contract,
                name: 'powerup',
                authorization: [{
                    actor: this.account_name,
                    permission: this.permission || 'active',
                }],
                data: {
                    cpu_frac,
                    net_frac,
                    days: powerup.days,
                    max_payment: assetdataToString(max_payment, symbol.name, symbol.precision),
                    payer: this.account_name,
                    receiver: this.account_name
                },
            }
            const result = await eos_api.getAPI().transact({
                actions: [action]
            }, {
                blocksBehind: 3,
                expireSeconds: 30,
            })

            const powerUpResult = ResourcesManager.getPowerUpResult(result as TransactResult)

            // Set new last lend time
            const dateNow = Date.now()  // Use the exact same date for cpu and net
            if(cpu){
                this.cpu.lastLend = dateNow
            }
            if(net){
                this.net.lastLend = dateNow
            }

            let paid : string
            if(powerUpResult){
                paid = String(powerUpResult.fee)
                const payment = stringToAsset(paid)
                this.dayCalculator.currentCosts += payment.amount
            } else {
                paid = 'an unkown amount of tokens'
            }
            await this.telegram.logCosts(`Borrowed ${cpu? 'CPU ':''}${cpu && net? 'and ':''}${net?'NET ':''}for ${TgM.sToMd(paid)} by ${TgM.sToMd(this.account_name)} on ${TgM.sToMd(this.eosio.network)}`, true, true)
            return true
        } catch (e){
            await this.telegram.logError(`⚡️ by ${this.account_name} on ${this.eosio.network} \n${String(e)}`)
            return false
        }
    }

    /**
     * Get power up result from a transaction result
     * @param trxResult Transaction result of a powerup action
     * @returns paid fee, powup_net and powup_cpu otherwise undefined
     */
    static getPowerUpResult(trxResult: TransactResult){
        if('processed' in trxResult && 'action_traces' in trxResult.processed && trxResult.processed.action_traces.length > 0){
            for(let act_traces of (trxResult as TransactResult).processed.action_traces){
                if('act' in act_traces && act_traces.act.account == 'eosio' && act_traces.act.name == 'powerup'){
                    for(let in_trace of (act_traces as {inline_traces: any}).inline_traces){
                        if('act' in in_trace && in_trace.act.account == 'eosio.reserv', in_trace.act.name == 'powupresult'){
                            if('fee' in in_trace.act.data && 'powup_net' in in_trace.act.data && 'powup_cpu' in in_trace.act.data){
                                return in_trace.act.data as {fee: string, powup_net: number, powup_cpu: number}
                            }
                        }
                    }
                }
            }
        }
        return undefined
    }

    /**
     * Check to borrow resources before the lending time of old loan is over
     * @param eos_api Eosio API
     */
    async checkBorrowTimeOut(eos_api: EosApi) {
        const dateNow = Date.now()
        const cpu = (dateNow - this.cpu.lastLend) >= this.maxBorrowDuration
        const net = (dateNow - this.net.lastLend) >= this.maxBorrowDuration
        
        if(cpu || net){
            let tries = 0
            let worked : boolean | undefined = false
            while(tries < eos_api.endpointList.length && worked === false){
                worked = await this.borrow(eos_api, cpu, net)
                tries++
                await eos_api.nextEndpoint()
                await sleep(5000)
            }
            if(worked === false){
                await this.telegram.logError(`🚨 *${TgM.sToMd(this.account_name)}* on *${TgM.sToMd(this.eosio.network)}* will give up to try to lend resources for an hour`, true, true)
                
                // Disable lendig for an hour
                const timeshift = (dateNow - this.maxBorrowDuration) + 3600000
                this.cpu.lastLend = timeshift
                this.net.lastLend = timeshift
            }
        }
    }

    private static BNPrecision = 1000000
    private static BlocksPerDay = 2*24*60*60

    static resource_to_frac(amount: number, limit: number, weight: number){
        const day_limit = limit * ResourcesManager.BlocksPerDay * ResourcesManager.BNPrecision
        const usage = Math.ceil(day_limit / weight)
        const frac = Math.floor((amount / Number(usage)) * ResourcesManager.BNPrecision) / weight
        return Math.floor(frac * Math.pow(10, 15))
    }

    static async getPowerUpState(eos_api: EosApi){
        for(let tries = 0; tries < eos_api.endpointList.length; tries++){
            try{
                const result = await eos_api.getRPC().get_table_rows({
                    json: true, 
                    code: 'eosio',
                    table: 'powup.state'
                    // Use no scope, "eosio" as scope will not work.
                })
                if('rows' in result && result.rows.length > 0){
                    return result.rows[0] as RawPowerUpState
                }
            } catch(e){
                console.log(`Error on getting entries from powup.state by ${eos_api.getEndpoint()}`, e)
                await eos_api.nextEndpoint()
                await sleep(1000)
            }
        }
        throw('No entries of powup.state found')
    }

    /**
     * Calculate frac parameters of EOSIO power up action by micro seconds of CPU and byte amount of NET 
     * @param eos_api EOSIO API
     * @param cpu_us Amount of CPU to lend
     * @param net_byte Amount of NET to lend
     * @returns cpu_frac and net_frac
     */
    static async calcFrecs(eos_api: EosApi, cpu_us: number, net_byte: number){
        // Get weights
        const state = await ResourcesManager.getPowerUpState(eos_api)
        if(state.version != 0){
            throw('Error wrong version of power up state')
        }

        // Get limits
        const info = eos_api.get_lastInfo()
        if(info == null){
            return {cpu: 0, net: 0}
        }
        
        return { 
            cpu: cpu_us == 0? 0 : ResourcesManager.resource_to_frac(cpu_us, info.block_cpu_limit, Number(state.cpu.weight)),
            net: net_byte == 0? 0 : ResourcesManager.resource_to_frac(net_byte, info.block_net_limit, Number(state.net.weight))
        }
    }
}