import { Asset, assetdataToString, sleep, stringToAsset } from '../scripts/helpers'
import { ConfigType, PowerUp } from './CommonTypes'
import { TgM } from './TelegramMesseger'
import { EosApi } from './EndpointSwitcher'

interface Ressource {
    available: number
    lastLend: number
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

            // Send transaction
            const action = {
                account: this.config_powerup.contract,
                name: 'powerup',
                authorization: [{
                    actor: this.account_name,
                    permission: this.permission || 'active',
                }],
                data: {
                    cpu_frac: cpu? powerup.cpu_frac : 0,
                    net_frac: net? powerup.net_frac : 0,
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

            // Set new last lend time
            const dateNow = Date.now()  // Use the exact same date for cpu and net
            if(cpu){
                this.cpu.lastLend = dateNow
            }
            if(net){
                this.net.lastLend = dateNow
            }

            await sleep(5000)
            // Check balances
            const afterBalances = await eos_api.getRPC().get_currency_balance(this.config_powerup.paymenttoken, this.account_name, this.dayCalculator.max_payment.symbol.name)
            const assetAfter = stringToAsset(afterBalances[0])
            const paymedAmount = assetBefore.amount - assetAfter.amount
            
            let paid : string
            if(paymedAmount < 0 || paymedAmount > max_payment){
                paid = 'an unkown amount of tokens'
            } else {
                this.dayCalculator.currentCosts += paymedAmount
                paid = assetdataToString(paymedAmount, assetAfter.symbol.name, assetAfter.symbol.precision)
            }
            await this.telegram.logCosts(`Borrowed ${cpu? 'CPU ':''}${cpu && net? 'and ':''}${net?'NET ':''}for ${TgM.sToMd(paid)} by ${TgM.sToMd(this.account_name)} on ${TgM.sToMd(this.eosio.network)}`, true, true)
            return true
        } catch (e){
            await this.telegram.logError(`⚡️ by ${this.account_name} on ${this.eosio.network} \n${String(e)}`)
            return false
        }
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
                await sleep(5000)
                eos_api.nextEndpoint()
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
   
}