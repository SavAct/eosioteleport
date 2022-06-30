import TelegramBot from 'node-telegram-bot-api'
import { Telegram } from "./CommonTypes"

// Telegram Messenger
export class TgM {
    static rpMarkDown = [
        { reg: /\\/g, repl: '\\' },  
        { reg: /\*/g, repl: '\\*' },
        { reg: /\_/g, repl: '\\_' },
        { reg: /\./g, repl: '\\.' },
        { reg: /\!/g, repl: '\\!' },
        { reg: /\+/g, repl: '\\+' },
        { reg: /\-/g, repl: '\\-' },
        { reg: /\`/g, repl: '\\`' },
        { reg: /#/g, repl: '\\#' },
        { reg: /\//g, repl: '\\/' },
        { reg: /\{/g, repl: '\\{' },
        { reg: /\}/g, repl: '\\}' },
        { reg: /\(/g, repl: '\\(' },
        { reg: /\)/g, repl: '\\)' },
        { reg: /\[/g, repl: '\\[' },
        { reg: /\]/g, repl: '\\]' },
        { reg: /\</g, repl: '&lt;' },
        { reg: /\>/g, repl: '&gt;' },
    ]
    
    /**
     * Replace special characters of a string into markdown 
     * @param str Raw string
     * @returns Markdown string
     */
    static sToMd = (str: string)=>{
        return TgM.rpMarkDown.reduce((str, replacement) => { return str.replace(replacement.reg, replacement.repl ) }, str)
    }

    private telegram: {
        bot : TelegramBot | undefined;
        statusIds : Array<number>;
        errorIds: Array<number>;
        costsIds: Array<number>;
    }  = {bot: undefined, statusIds: [], errorIds: [], costsIds:[]}

    public isTelegram(){
        return this.telegram.bot? true : false
    }

    constructor(config_telegram: Telegram | undefined){
        if(config_telegram){
            if(typeof config_telegram.statusIds != 'object'){
                console.error('Use the telegram id provider to get you personal contactId and store it in the config file')
                process.exit(1)
            } else {
                this.telegram.statusIds = config_telegram.statusIds
                if(config_telegram.errorIds){
                    this.telegram.errorIds = config_telegram.errorIds
                }
            }
            if(config_telegram.costsIds){
                this.telegram.costsIds = config_telegram.costsIds
            }
            this.telegram.bot = new TelegramBot(config_telegram.privateToken, {polling: false});
        }
    }

    /**
     * Send a message to a telegram account
     * @param msg Message
     */
    public async logViaBot(msg: string, markdown: boolean = false, no_convert?: boolean) {
        console.log(msg)
        if(this.telegram.bot){
            for (let id of this.telegram.statusIds) {
                await this.telegram.bot.sendMessage(id, no_convert === true? msg : TgM.sToMd(msg), { parse_mode: markdown? 'MarkdownV2': undefined})
            }
        }
    }

    /**
     * Send a message to telegram accounts which are marked for error log
     * @param msg 
     * @param markdown 
     */
    public async logError(msg: string, markdown: boolean = false, no_convert?: boolean){
        console.error(msg)
        if(this.telegram.bot && this.telegram.errorIds.length > 0){
            for (let id of this.telegram.errorIds) {
                await this.telegram.bot.sendMessage(id, no_convert === true? msg : TgM.sToMd(msg), { parse_mode: markdown? 'MarkdownV2': undefined})
            }
        }
    }
    /**
     * Send a message to telegram accounts which are marked to receive messages about payed costs
     * @param msg 
     * @param markdown 
     */
    public async logCosts(msg: string, markdown: boolean = false, no_convert?: boolean){
        console.error(msg)
        if(this.telegram.bot && this.telegram.costsIds.length > 0){
            for (let id of this.telegram.costsIds) {
                await this.telegram.bot.sendMessage(id, no_convert === true? msg : TgM.sToMd(msg), { parse_mode: markdown? 'MarkdownV2': undefined})
            }
        }
    }
}