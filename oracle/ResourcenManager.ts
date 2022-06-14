import { Asset, assetdataToString, sleep, stringToAsset } from '../scripts/helpers'
import { ConfigType, PowerUp } from './CommonTypes'
import { TelegramMessenger } from './TelegramMesseger'
import { EosApi } from './EndpointSwitcher'

export class ResourcesManager {
    private dayCalculator : {currentCosts: bigint, fromTime: number, max_payment: Asset} = {
        currentCosts: BigInt(0),
        fromTime: 0,
        max_payment: {amount:BigInt(0), symbol:{name:'', precision:0}}
    }

    private account_name: string = ''
    private permission: string ='active'
    private cpu_available = 0
    private net_available = 0

    constructor(private config_powerup: PowerUp | undefined, private eosio: ConfigType["eos"], private telegram: TelegramMessenger){
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
    }

    public isManager(){
        return this.config_powerup? true : false
    }

    async check(eos_api: EosApi) {
        if(!this.config_powerup){
            return
        }
        const result = await eos_api.getRPC().get_account(this.account_name) 
        this.cpu_available = result.cpu_limit.available
        this.net_available = result.net_limit.available
        
        const rentCPU = this.cpu_available < this.config_powerup.min_cpu
        const rentNET = this.net_available < this.config_powerup.min_net        
        this.borrow(eos_api, rentCPU, rentNET)
    }

    /**
     * Borrow resources
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
            await this.telegram.logCosts(`🚫 Max tokens per day is not enough to borrow ${cpu? 'CPU ':''}${cpu && net? 'and ':''}${net?'NET ':''} by ${this.account_name} on ${this.eosio.network}`, true)
            return
        }
        try{
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
                await this.telegram.logCosts(`🚨 System tokens are running out by ${this.account_name} on ${this.eosio.network}, ${balance} remain`, true)
            }

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
console.log('borrow action', action); //-

            const result = await eos_api.getAPI().transact({
                actions: [action]
            }, {
                blocksBehind: 3,
                expireSeconds: 30,
            })
console.log('got result'); //-
            await sleep(5000)
            const afterBalances = await eos_api.getRPC().get_currency_balance(this.config_powerup.paymenttoken, this.account_name, this.dayCalculator.max_payment.symbol.name)
            const assetAfter = stringToAsset(afterBalances[0])
            const paymedAmount = assetBefore.amount - assetAfter.amount
            let paid : string
            if(paymedAmount < 0 || paymedAmount > max_payment){
                this.dayCalculator.currentCosts += paymedAmount
                paid = assetdataToString(paymedAmount, assetAfter.symbol.name, assetAfter.symbol.precision)
            } else {
                paid = 'an unkown amount of tokens'
            }
            await this.telegram.logCosts(`Borrowed ${cpu? 'CPU ':''}${cpu && net? 'and ':''}${net?'NET ':''}for ${paid} by ${this.account_name} on ${this.eosio.network}`, true)
        } catch (e){
            await this.telegram.logError(`⚡️ by ${this.account_name} on ${this.eosio.network}. ${String(e)}`, true)
        }
    }
   
}