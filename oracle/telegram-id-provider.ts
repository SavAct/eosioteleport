/* Send a telegram message to this bot to get your telegram id */

process.env.NTBA_FIX_319 = '1'; // Needed to disable TelegramBot warning
import TelegramBot from 'node-telegram-bot-api';
import yargs from 'yargs';
import { ConfigType } from './CommonTypes';

// Handle params from console
const argv = yargs
    .version()
    .alias('version', 'v')
    .option('token', {
        alias: 't',
        description: 'Secret telegram bot token',
        type: 'string',
    })
    .option('config', {
        alias: 'c',
        description: 'Path of config file',
        type: 'string',
    })
    .help()
    .alias('help', 'h').argv as {
    token: string;
    config: string;
};

// Load config and set title
const config_path = argv.config || process.env['CONFIG'] || './config';
process.title = `telegram-id-provider`;
const configFile: ConfigType = require(config_path);

let token: string | undefined = undefined;
if (argv.token) {
    token = argv.token;
} else if (configFile.telegram) {
    token = configFile.telegram.privateToken;
}

if (token) {
    const bot = new TelegramBot(token, { polling: true });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        // send a message to the chat acknowledging receipt of their message
        if (Date.now() / 1000 - msg.date <= 60) {
            bot.sendMessage(chatId, 'Your telegram id is: ' + String(chatId));
            if (msg.text) {
                console.log(String(chatId) + ':', msg.text);
                if (msg.text == 'close') {
                    await bot.deleteMessage(msg.chat.id, msg.message_id).catch((er) => {
                        return;
                    });
                    bot.removeAllListeners();
                    await bot.close();

                    setTimeout(async () => {
                        process.exit(0);
                    }, 5000);
                    console.log('Close in 5 seconds');
                }
            }
        }
    });
}
