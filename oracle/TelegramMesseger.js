"use strict";
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
exports.TelegramMessenger = void 0;
var node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
var TelegramMessenger = /** @class */ (function () {
    function TelegramMessenger(config_telegram) {
        this.telegram = { bot: undefined, statusIds: [], errorIds: [], costsIds: [] };
        if (config_telegram) {
            if (typeof config_telegram.statusIds != 'object') {
                console.error('Use the telegram id provider to get you personal contactId and store it in the config file');
                process.exit(1);
            }
            else {
                this.telegram.statusIds = config_telegram.statusIds;
                if (config_telegram.errorIds) {
                    this.telegram.errorIds = config_telegram.errorIds;
                }
            }
            if (config_telegram.costsIds) {
                this.telegram.costsIds = config_telegram.costsIds;
            }
            this.telegram.bot = new node_telegram_bot_api_1.default(config_telegram.privateToken, { polling: false });
        }
    }
    TelegramMessenger.prototype.isTelegram = function () {
        return this.telegram.bot ? true : false;
    };
    /**
     * Send a message to a telegram account
     * @param msg Message
     */
    TelegramMessenger.prototype.logViaBot = function (msg, markdown, no_convert) {
        if (markdown === void 0) { markdown = false; }
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, id;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log(msg);
                        if (!this.telegram.bot) return [3 /*break*/, 4];
                        _i = 0, _a = this.telegram.statusIds;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        id = _a[_i];
                        return [4 /*yield*/, this.telegram.bot.sendMessage(id, no_convert === true ? msg : TelegramMessenger.stringToMarkDown(msg), { parse_mode: markdown ? 'MarkdownV2' : undefined })];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send a message to telegram accounts which are marked for error log
     * @param msg
     * @param markdown
     */
    TelegramMessenger.prototype.logError = function (msg, markdown, no_convert) {
        if (markdown === void 0) { markdown = false; }
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, id;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.error(msg);
                        if (!(this.telegram.bot && this.telegram.errorIds.length > 0)) return [3 /*break*/, 4];
                        _i = 0, _a = this.telegram.errorIds;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        id = _a[_i];
                        return [4 /*yield*/, this.telegram.bot.sendMessage(id, no_convert === true ? msg : TelegramMessenger.stringToMarkDown(msg), { parse_mode: markdown ? 'MarkdownV2' : undefined })];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send a message to telegram accounts which are marked to receive messages about payed costs
     * @param msg
     * @param markdown
     */
    TelegramMessenger.prototype.logCosts = function (msg, markdown, no_convert) {
        if (markdown === void 0) { markdown = false; }
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, id;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.error(msg);
                        if (!(this.telegram.bot && this.telegram.costsIds.length > 0)) return [3 /*break*/, 4];
                        _i = 0, _a = this.telegram.costsIds;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        id = _a[_i];
                        return [4 /*yield*/, this.telegram.bot.sendMessage(id, no_convert === true ? msg : TelegramMessenger.stringToMarkDown(msg), { parse_mode: markdown ? 'MarkdownV2' : undefined })];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    TelegramMessenger.rpMarkDown = [
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
    ];
    /**
     * Replace special characters of a string into markdown
     * @param str Raw string
     * @returns Markdown string
     */
    TelegramMessenger.stringToMarkDown = function (str) {
        return TelegramMessenger.rpMarkDown.reduce(function (str, replacement) { return str.replace(replacement.reg, replacement.repl); }, str);
    };
    return TelegramMessenger;
}());
exports.TelegramMessenger = TelegramMessenger;
