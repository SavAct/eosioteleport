"use strict";
/* Send a telegram message to this bot to get your telegram id */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NTBA_FIX_319 = '1'; // Needed to disable TelegramBot warning
var node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
var yargs_1 = __importDefault(require("yargs"));
// Handle params from console
var argv = yargs_1.default
    .version().alias('version', 'v')
    .option('token', {
    alias: 't',
    description: 'Secret telegram bot token',
    type: 'string'
})
    .option('config', {
    alias: 'c',
    description: 'Path of config file',
    type: 'string'
})
    .help().alias('help', 'h').argv;
// Load config and set title
var config_path = argv.config || process.env['CONFIG'] || './config';
process.title = "telegram-id-provider";
var configFile = require(config_path);
var token = undefined;
if (argv.token) {
    token = argv.token;
}
else if (configFile.telegram) {
    token = configFile.telegram.privateToken;
}
if (token) {
    var bot_1 = new node_telegram_bot_api_1.default(token, { polling: true });
    bot_1.on('message', function (msg) { return __awaiter(void 0, void 0, void 0, function () {
        var chatId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chatId = msg.chat.id;
                    if (!((Date.now() / 1000) - msg.date <= 60)) return [3 /*break*/, 3];
                    bot_1.sendMessage(chatId, 'Your telegram id is: ' + String(chatId));
                    if (!msg.text) return [3 /*break*/, 3];
                    console.log(String(chatId) + ':', msg.text);
                    if (!(msg.text == 'close')) return [3 /*break*/, 3];
                    return [4 /*yield*/, bot_1.deleteMessage(msg.chat.id, String(msg.message_id)).catch(function (er) { return; })];
                case 1:
                    _a.sent();
                    bot_1.removeAllListeners();
                    return [4 /*yield*/, bot_1.close()];
                case 2:
                    _a.sent();
                    setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        process.exit(0);
                        return [2 /*return*/];
                    }); }); }, 5000);
                    console.log('Close in 5 seconds');
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
