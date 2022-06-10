"use strict";
/*
    This oracle listens to the ethereum blockchain for `Teleport` and `Claimed` events.

    When an `Teleport` event is received, it will call the `received` action on the EOSIO chain.
    On receiving a `Claimed` event, it will call the `claimed` action on the EOSIO chain.
 */
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NTBA_FIX_319 = '1'; // Needed to disable TelegramBot warning
var fs_1 = __importDefault(require("fs"));
var ethers_1 = require("ethers");
var yargs_1 = __importDefault(require("yargs"));
var eosjs_jssig_1 = require("eosjs/dist/eosjs-jssig");
var EndpointSwitcher_1 = require("./EndpointSwitcher");
var helpers_1 = require("../scripts/helpers");
var node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
var eosjs_1 = require("eosjs");
var EthOracle = /** @class */ (function () {
    function EthOracle(config, signatureProvider) {
        this.config = config;
        this.signatureProvider = signatureProvider;
        this.running = false;
        this.minTrySend = 3;
        this.dayCalculator = {
            currentCosts: BigInt(0),
            fromTime: 0,
            max_payment: { amount: BigInt(0), symbol: { name: '', precision: 0 } }
        };
        this.telegram = { bot: undefined, statusIds: [], errorIds: [], costsIds: [] };
        // Standardise the net id
        this.config.eos.netId = this.config.eos.netId.toLowerCase();
        if (this.config.eos.netId[1] == 'x') {
            this.config.eos.netId = this.config.eos.netId.substring(2);
        }
        // Set further initial data
        this.blocksToWait = typeof config.eth.blocksToWait == 'number' && config.eth.blocksToWait > EthOracle.MIN_BLOCKS_TO_WAIT ? config.eth.blocksToWait : EthOracle.MIN_BLOCKS_TO_WAIT;
        this.blocks_file_name = ".oracle_".concat(configFile.eth.network, "_block-").concat(configFile.eth.oracleAccount);
        this.minTrySend = Math.max(this.minTrySend, config.eos.endpoints.length);
        // Initialize the telegram bot and lend options
        this.iniBot();
        this.iniBorrow();
        // Create interfaces for eosio and eth chains
        this.eos_api = new EndpointSwitcher_1.EosApi(this.config.eos.netId, this.config.eos.endpoints, this.signatureProvider);
        this.eth_api = new EndpointSwitcher_1.EthApi(this.config.eth.netId, this.config.eth.endpoints);
        // Set the version specific data
        this.version = 0;
        switch (this.config.version) {
            case 2:
                this.version = 2;
                this.claimed_logEvent = EthOracle.version_v2.claimed;
                this.teleport_logEvent = EthOracle.version_v2.teleport;
                break;
            case 1: this.version = 1;
            case 0:
            default:
                this.claimed_logEvent = EthOracle.version_v1.claimed;
                this.teleport_logEvent = EthOracle.version_v1.teleport;
        }
    }
    /**
     * Initialize the telegram bot
     */
    EthOracle.prototype.iniBot = function () {
        if (this.config.telegram) {
            if (typeof this.config.telegram.statusIds != 'object') {
                console.error('Use the telegram id provider to get you personal contactId and store it in the config file');
                process.exit(1);
            }
            else {
                this.telegram.statusIds = this.config.telegram.statusIds;
                if (this.config.telegram.errorIds) {
                    this.telegram.errorIds = this.config.telegram.errorIds;
                }
            }
            this.telegram.bot = new node_telegram_bot_api_1.default(this.config.telegram.privateToken, { polling: false });
        }
    };
    /**
     * Initialize borrow options
     */
    EthOracle.prototype.iniBorrow = function () {
        if (this.config.powerup) {
            var asset = (0, helpers_1.stringToAsset)(this.config.powerup.max_payment);
            if (asset.amount != BigInt(0) && typeof asset.symbol.precision != 'number' && asset.symbol.name.length > 0) {
                throw ('Wrong definition of lend.max_payment');
            }
            if (this.config.eos.network == 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906') {
                if (this.config.powerup.contract != 'eosio') {
                    throw ('Wrong powerup contract');
                }
                if (this.config.powerup.paymenttoken != 'eosio.token') {
                    throw ('Wrong system token symbol for powerup');
                }
                if (asset.symbol.name != 'EOS') {
                    throw ('Wrong token symbol of powerup.max_payment');
                }
                if (asset.symbol.precision != 4) {
                    throw ('Wrong token precision of powerup.max_payment');
                }
            }
            this.dayCalculator.max_payment = (0, helpers_1.stringToAsset)(this.config.powerup.max_payment);
        }
    };
    /**
     * Send a message to a telegram account
     * @param msg Message
     */
    EthOracle.prototype.logViaBot = function (msg, markdown, no_convert) {
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
                        return [4 /*yield*/, this.telegram.bot.sendMessage(id, no_convert === true ? msg : (0, helpers_1.stringToMarkDown)(msg), { parse_mode: markdown ? 'MarkdownV2' : undefined })];
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
    EthOracle.prototype.logError = function (msg, markdown, no_convert) {
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
                        return [4 /*yield*/, this.telegram.bot.sendMessage(id, no_convert === true ? msg : (0, helpers_1.stringToMarkDown)(msg), { parse_mode: markdown ? 'MarkdownV2' : undefined })];
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
    EthOracle.prototype.logCosts = function (msg, markdown, no_convert) {
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
                        return [4 /*yield*/, this.telegram.bot.sendMessage(id, no_convert === true ? msg : (0, helpers_1.stringToMarkDown)(msg), { parse_mode: markdown ? 'MarkdownV2' : undefined })];
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
     * Get object of the data of an "claimed"-event on eth chain
     * @param data "claimed"-event data
     * @param config Contains information of precision and symbol of the token as well as the oracle name of this contract
     * @returns
     */
    EthOracle.extractEthClaimedData = function (version, data, config) {
        if (version >= 2) {
            var chainNet = data[0].toString();
            if (chainNet.length < 10) {
                console.log('Wrong length of net id', chainNet);
                return false;
            }
            chainNet = chainNet.substring(2, 10).toLowerCase();
            if (config.eos.netId.substring(0, 8) != chainNet) {
                console.log("Found teleport with other net id ".concat(chainNet, " is not queal to ").concat(config.eos.netId.substring(0, 8)));
                return false;
            }
            var to_eth = data[1].replace('0x', '') + '000000000000000000000000';
            var combiparam = data[2].toHexString();
            if (combiparam.length > 66) {
                console.log('Wrong combined parameters', combiparam);
                return false;
            }
            var _a = EthOracle.getLogTelParams(combiparam.substring(2).padStart(64, '0')), chain_id = _a.chain_id, id = _a.id, quantity = _a.quantity;
            if (chain_id != config.eos.id) {
                console.log('Wrong chain id', chain_id);
                return false;
            }
            return { oracle_name: config.eos.oracleAccount, id: id, to_eth: to_eth, quantity: quantity };
        }
        else {
            var id = BigInt(data[0].toString());
            var to_eth = data[1].replace('0x', '') + '000000000000000000000000';
            var amount = BigInt(data[2].toString());
            var quantity = (0, helpers_1.assetdataToString)(amount, config.symbol, config.precision);
            return { oracle_name: config.eos.oracleAccount, id: id, to_eth: to_eth, quantity: quantity };
        }
    };
    EthOracle.getLogTelParams = function (hexString) {
        var chain_id = Number('0x' + hexString.slice(14, 16));
        var id = BigInt('0x' + hexString.substring(16, 32));
        var symbol_and_precision = hexString.substring(32, 48);
        var amount = BigInt('0x' + hexString.substring(48));
        var symbolhex = symbol_and_precision.substring(2);
        var symbol = (0, helpers_1.hexToString)(symbolhex);
        var precision = Number('0x' + symbol_and_precision.substring(0, 2));
        var quantity = (0, helpers_1.assetdataToString)(amount, symbol, precision);
        return { chain_id: chain_id, id: id, quantity: quantity, amount: amount };
    };
    /**
     * Get object of the data of an "teleport"-event on eth chain
     * @param data "teleport"-event data
     * @param config Contains information of precision and symbol of the token as well as the oracle name of this contract
     * @returns
     */
    EthOracle.extractEthTeleportData = function (version, data, transactionHash, config) {
        var txid = transactionHash.replace(/^0x/, '');
        if (version >= 2) {
            var to = data[0];
            var combiparam = data[1].toHexString();
            if (combiparam.length > 66) {
                console.log('Wrong combined parameters', combiparam);
                return false;
            }
            var _a = EthOracle.getLogTelParams(combiparam.substring(2).padStart(64, '0')), chain_id = _a.chain_id, id = _a.id, quantity = _a.quantity, amount = _a.amount;
            if (chain_id != config.eos.id) {
                console.log('Wrong chain id', chain_id);
                return false;
            }
            if (amount == BigInt(0)) {
                console.log('Tokens are less than or equal to 0');
                return false;
            }
            return { chain_id: chain_id, confirmed: true, quantity: quantity, to: to, oracle_name: config.eos.oracleAccount, index: id, ref: txid };
        }
        else {
            var to = data[0];
            var amount = BigInt(data[1].toString());
            if (amount == BigInt(0)) {
                throw new Error('Tokens are less than or equal to 0');
            }
            var quantity = (0, helpers_1.assetdataToString)(amount, config.symbol, config.precision);
            var chain_id = data[2].toNumber();
            return { chain_id: chain_id, confirmed: true, quantity: quantity, to: to, oracle_name: config.eos.oracleAccount, ref: txid };
        }
    };
    /**
     * Wait until an event got enough confirmations and validations by other endpoints
     * @param entry.transactionHash Hash of the transaction which contains the event
     * @param entry.data Event data in raw format
     * @returns False if there are not enough endpoints which validate the event
     */
    EthOracle.prototype.await_confirmation = function (entry) {
        return __awaiter(this, void 0, void 0, function () {
            var validators, firstEp, receipt, overConfs, ep, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validators = new Set();
                        if (this.eth_api.get_EndpointAmount() < this.config.eth.epVerifications) {
                            throw Error('Not enough eth endpoints for validation ❌');
                        }
                        firstEp = undefined;
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 14];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 10, , 12]);
                        return [4 /*yield*/, this.eth_api.getProvider().getTransactionReceipt(entry.transactionHash)];
                    case 3:
                        receipt = _a.sent();
                        if (!receipt) return [3 /*break*/, 7];
                        overConfs = receipt.confirmations - this.blocksToWait;
                        if (!(overConfs > 0)) return [3 /*break*/, 6];
                        ep = this.eth_api.getEndpoint();
                        validators.add(ep);
                        if (receipt.logs.find(function (e) { return e.data == entry.data; }) == undefined) {
                            console.log("Event data of ".concat(entry.transactionHash, " was not found by ").concat(ep, " \u274C"));
                            return [2 /*return*/, false];
                        }
                        console.log("Cofirmations ".concat(receipt.confirmations, " by ").concat(ep));
                        if (validators.size >= this.config.eth.epVerifications) {
                            console.log("TX ".concat(entry.transactionHash, " has ").concat(receipt.confirmations, " confirmations"));
                            return [2 /*return*/, true];
                        }
                        if (!(overConfs > 1)) return [3 /*break*/, 4];
                        if (firstEp == undefined) {
                            firstEp = ep;
                        }
                        else if (firstEp == ep) {
                            console.error("Verification failed, only ".concat(validators.size, " eth endpoints verified the transaction ").concat(entry.transactionHash, " \u274C"));
                            return [2 /*return*/, false];
                        }
                        return [3 /*break*/, 6];
                    case 4: 
                    // Sleep one second to check other endpoints if the confirmation amount is just reached
                    return [4 /*yield*/, (0, helpers_1.sleep)(1000)];
                    case 5:
                        // Sleep one second to check other endpoints if the confirmation amount is just reached
                        _a.sent();
                        _a.label = 6;
                    case 6: return [3 /*break*/, 9];
                    case 7: return [4 /*yield*/, (0, helpers_1.sleep)(10000)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9: return [3 /*break*/, 12];
                    case 10:
                        e_1 = _a.sent();
                        console.error('Error on get transaction receipt', e_1);
                        return [4 /*yield*/, (0, helpers_1.sleep)(1000)];
                    case 11:
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 12: return [4 /*yield*/, this.eth_api.nextEndpoint()];
                    case 13:
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    EthOracle.save_block_to_file = function (block_num, blocks_file) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                fs_1.default.writeFileSync(blocks_file, block_num.toString());
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check for "claimed" events and store them on eosio chain
     * @param from_block Block number to start looking for events
     * @param to_block Block number to end looking for events
     * @param trxBroadcast False if the transaction should not be broadcasted (not submitted to the block chain)
     */
    EthOracle.prototype.process_claimed = function (from_block, to_block, trxBroadcast) {
        var e_2, _a;
        if (trxBroadcast === void 0) { trxBroadcast = true; }
        return __awaiter(this, void 0, void 0, function () {
            var query, res, res_1, res_1_1, entry, decodedData, eosioData, actions, eos_res, e_2_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        query = {
                            fromBlock: from_block,
                            toBlock: to_block,
                            address: this.config.eth.teleportContract,
                            topics: [this.claimed_logEvent.topic],
                        };
                        return [4 /*yield*/, this.eth_api.getProvider().getLogs(query)
                            // Mark each claimed event on eosio chain as claimed
                        ];
                    case 1:
                        res = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 9, 10, 15]);
                        res_1 = __asyncValues(res);
                        _b.label = 3;
                    case 3: return [4 /*yield*/, res_1.next()];
                    case 4:
                        if (!(res_1_1 = _b.sent(), !res_1_1.done)) return [3 /*break*/, 8];
                        entry = res_1_1.value;
                        decodedData = ethers_1.ethers.utils.defaultAbiCoder.decode(this.claimed_logEvent.decode, entry.data);
                        eosioData = EthOracle.extractEthClaimedData(this.version, decodedData, this.config);
                        // When teleport does not refer to this eosio chain
                        if (eosioData === false) {
                            console.log('Continue');
                            return [3 /*break*/, 7];
                        }
                        return [4 /*yield*/, this.await_confirmation(entry)];
                    case 5:
                        // Wait for confirmation of each transaction before continuing
                        if (!(_b.sent())) {
                            console.log("Skip claimed event with ".concat(eosioData.to_eth, " as recipient and the id ").concat(eosioData.id));
                            return [3 /*break*/, 7];
                        }
                        // Continue this event if it was marked as removed
                        if (entry.removed) {
                            this.logError("Claimed event with trx hash ".concat(entry.transactionHash, " got removed and will be skipped by ").concat(this.config.eos.oracleAccount, " on ").concat(this.config.eth.network, " \u274C"));
                            return [3 /*break*/, 7];
                        }
                        actions = [{
                                account: this.config.eos.teleportContract,
                                name: 'claimed',
                                authorization: [{
                                        actor: this.config.eos.oracleAccount,
                                        permission: this.config.eos.oraclePermission || 'active',
                                    }],
                                data: eosioData,
                            }];
                        return [4 /*yield*/, this.sendTransaction(actions, trxBroadcast)];
                    case 6:
                        eos_res = _b.sent();
                        if (eos_res === false) {
                            this.logError("Skip sending claimed of id ".concat(eosioData.id, " to eosio chain by ").concat(this.config.eos.oracleAccount, " from ").concat(this.config.eth.network, " \u274C"));
                        }
                        else if (eos_res === true) {
                            console.log("Id ".concat(eosioData.id, " is already claimed, account 0x").concat(eosioData.to_eth.substring(0, 40), ", quantity ").concat(eosioData.quantity, " \u2714\uFE0F"));
                        }
                        else {
                            console.log("Send claimed of id ".concat(eosioData.id, ", account 0x").concat(eosioData.to_eth.substring(0, 40), ", quantity ").concat(eosioData.quantity, ". EOSIO blocknumber ").concat(eos_res.processed.block_num, " and trx id ").concat(eos_res.transaction_id, " \u2714\uFE0F"));
                        }
                        _b.label = 7;
                    case 7: return [3 /*break*/, 3];
                    case 8: return [3 /*break*/, 15];
                    case 9:
                        e_2_1 = _b.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 15];
                    case 10:
                        _b.trys.push([10, , 13, 14]);
                        if (!(res_1_1 && !res_1_1.done && (_a = res_1.return))) return [3 /*break*/, 12];
                        return [4 /*yield*/, _a.call(res_1)];
                    case 11:
                        _b.sent();
                        _b.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        if (e_2) throw e_2.error;
                        return [7 /*endfinally*/];
                    case 14: return [7 /*endfinally*/];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send transaction to EOSIO chain
     * @param actions EOSIO transaction actions
     * @param trxBroadcast Boolean to broadcast a transaction
     * @returns False if it fails, true if a transaction was already marked as claimed or the object of the transaction result
     */
    EthOracle.prototype.sendTransaction = function (actions, trxBroadcast) {
        if (trxBroadcast === void 0) { trxBroadcast = true; }
        return __awaiter(this, void 0, void 0, function () {
            var tries, eos_res, e_3, error, s;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tries = 0;
                        _a.label = 1;
                    case 1:
                        if (!(tries < this.minTrySend)) return [3 /*break*/, 8];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 7]);
                        return [4 /*yield*/, this.eos_api.getAPI().transact({ actions: actions }, {
                                blocksBehind: 3,
                                expireSeconds: 30,
                                broadcast: trxBroadcast
                            })];
                    case 3:
                        eos_res = _a.sent();
                        return [2 /*return*/, eos_res];
                    case 4:
                        e_3 = _a.sent();
                        error = 'Unkwon error';
                        if (e_3.message) {
                            s = e_3.message.indexOf(':') + 1;
                            if (s > 0 && s < e_3.message.length) {
                                error = e_3.message.substring(s);
                            }
                            else {
                                error = e_3.message;
                            }
                            // Check if the error appears because the transaction is already claimed or approved
                            if (error.indexOf('Already marked as claimed') > -1 || error.indexOf('Oracle has already approved') > -1 || error.indexOf('already completed') > -1) {
                                return [2 /*return*/, true];
                            }
                        }
                        console.error("Error while sending to eosio chain with ".concat(this.eos_api.getEndpoint(), ": ").concat(error, " \u274C\n").concat(String(e_3)));
                        if (e_3 instanceof eosjs_1.RpcError) {
                            if ('code' in e_3.json && 'error' in e_3.json && 'code' in e_3.json.error) {
                                switch (e_3.json.error.code) {
                                    // case 3010004: break          // Unauthorized
                                    // case 3080001: break          // RAM exceeded
                                    case 3080002: // NET exceeded
                                        this.borrowResources(false, true);
                                        break;
                                    case 3080004: // CPU exceeded
                                        this.borrowResources(true, false);
                                        break;
                                }
                            }
                        }
                        return [4 /*yield*/, this.eos_api.nextEndpoint()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, helpers_1.sleep)(1000)];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 7:
                        tries++;
                        return [3 /*break*/, 1];
                    case 8: return [2 /*return*/, false];
                }
            });
        });
    };
    /**
     * Borrow resources
     * @param cpu True to borrow CPU
     * @param net True to borrow NET
     */
    EthOracle.prototype.borrowResources = function (cpu, net) {
        if (cpu === void 0) { cpu = false; }
        if (net === void 0) { net = false; }
        return __awaiter(this, void 0, void 0, function () {
            var powerup, max_payment, symbol, assetBefore, _a, result, assetAfter, _b, paymedAmount, paid, e_4;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.config.powerup) {
                            return [2 /*return*/];
                        }
                        if (!cpu && !net) {
                            console.log('No resource to borrow');
                            return [2 /*return*/];
                        }
                        powerup = this.config.powerup;
                        if ((Date.now() - this.dayCalculator.fromTime) >= (24 * 3600000)) {
                            this.dayCalculator.fromTime = Date.now();
                            this.dayCalculator.currentCosts = BigInt(0);
                            max_payment = this.dayCalculator.max_payment.amount;
                        }
                        else {
                            max_payment = this.dayCalculator.max_payment.amount - this.dayCalculator.currentCosts;
                        }
                        symbol = this.dayCalculator.max_payment.symbol;
                        if (!(max_payment <= 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.logCosts("\uD83D\uDEAB Max tokens per day is not enough to borrow ".concat(cpu ? 'CPU ' : '').concat(cpu && net ? 'and ' : '').concat(net ? 'NET ' : '', " by ").concat(this.config.eos.oracleAccount, " on ").concat(this.config.eos.network), true)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                    case 2:
                        _c.trys.push([2, 8, , 10]);
                        _a = helpers_1.stringToAsset;
                        return [4 /*yield*/, this.eos_api.getRPC().get_currency_balance('eosio.token', this.config.eos.oracleAccount, 'EOS')];
                    case 3:
                        assetBefore = _a.apply(void 0, [(_c.sent())[0]]);
                        return [4 /*yield*/, this.eos_api.getAPI().transact({
                                actions: [{
                                        account: 'eosio',
                                        name: 'powerup',
                                        authorization: [{
                                                actor: this.config.eos.oracleAccount,
                                                permission: this.config.eos.oraclePermission || 'active',
                                            }],
                                        data: {
                                            cpu_frac: cpu ? powerup.cpu_frac : 0,
                                            net_frac: net ? powerup.net_frac : 0,
                                            days: powerup.days,
                                            max_payment: (0, helpers_1.assetdataToString)(max_payment, symbol.name, symbol.precision),
                                            payer: this.config.eos.oracleAccount,
                                            receiver: this.config.eos.oracleAccount
                                        },
                                    }]
                            }, {
                                blocksBehind: 3,
                                expireSeconds: 30,
                            })];
                    case 4:
                        result = _c.sent();
                        return [4 /*yield*/, (0, helpers_1.sleep)(5000)];
                    case 5:
                        _c.sent();
                        _b = helpers_1.stringToAsset;
                        return [4 /*yield*/, this.eos_api.getRPC().get_currency_balance('eosio.token', this.config.eos.oracleAccount, 'EOS')];
                    case 6:
                        assetAfter = _b.apply(void 0, [(_c.sent())[0]]);
                        paymedAmount = assetBefore.amount - assetAfter.amount;
                        paid = void 0;
                        if (paymedAmount < 0 || paymedAmount > max_payment) {
                            this.dayCalculator.currentCosts += paymedAmount;
                            paid = (0, helpers_1.assetdataToString)(paymedAmount, assetAfter.symbol.name, assetAfter.symbol.precision);
                        }
                        else {
                            paid = 'an unkown amount of tokens';
                        }
                        return [4 /*yield*/, this.logCosts("Borrowed ".concat(cpu ? 'CPU ' : '').concat(cpu && net ? 'and ' : '').concat(net ? 'NET ' : '', "for ").concat(paid, " by ").concat(this.config.eos.oracleAccount, " on ").concat(this.config.eos.network), true)];
                    case 7:
                        _c.sent();
                        return [3 /*break*/, 10];
                    case 8:
                        e_4 = _c.sent();
                        return [4 /*yield*/, this.logError("\u26A1\uFE0F by ".concat(this.config.eos.oracleAccount, " on ").concat(this.config.eos.network, ". ").concat(String(e_4)), true)];
                    case 9:
                        _c.sent();
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check for "teleport" events and store them on eosio chain
     * @param from_block Block number to start looking for events
     * @param to_block Block number to end looking for events
     * @param trxBroadcast False if the transaction should not be broadcasted (not submitted to the block chain)
     */
    EthOracle.prototype.process_teleported = function (from_block, to_block, trxBroadcast) {
        var e_5, _a;
        if (trxBroadcast === void 0) { trxBroadcast = true; }
        return __awaiter(this, void 0, void 0, function () {
            var query, res, res_2, res_2_1, entry, decodedData, eosioData, actions, eos_res, e_5_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        query = {
                            fromBlock: from_block,
                            toBlock: to_block,
                            address: this.config.eth.teleportContract,
                            topics: [this.teleport_logEvent.topic],
                        };
                        return [4 /*yield*/, this.eth_api.getProvider().getLogs(query)
                            // Confirm each teleport event on eosio chain
                        ];
                    case 1:
                        res = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 9, 10, 15]);
                        res_2 = __asyncValues(res);
                        _b.label = 3;
                    case 3: return [4 /*yield*/, res_2.next()];
                    case 4:
                        if (!(res_2_1 = _b.sent(), !res_2_1.done)) return [3 /*break*/, 8];
                        entry = res_2_1.value;
                        decodedData = ethers_1.ethers.utils.defaultAbiCoder.decode(this.teleport_logEvent.decode, entry.data);
                        eosioData = EthOracle.extractEthTeleportData(this.version, decodedData, entry.transactionHash, this.config);
                        if (eosioData === false) {
                            console.log('Continue');
                            return [3 /*break*/, 7];
                        }
                        // Check id is equal to recipient chain
                        if (this.config.eos.id !== undefined && eosioData.chain_id !== Number(this.config.eos.id)) {
                            console.log("Skip teleport event with ".concat(eosioData.to, " as recipient and ref of ").concat(eosioData.ref, " because the chain id ").concat(eosioData.chain_id, " referes to another blockchain."));
                            return [3 /*break*/, 7];
                        }
                        return [4 /*yield*/, this.await_confirmation(entry)];
                    case 5:
                        // Wait for confirmation of each transaction before continuing
                        if (!(_b.sent())) {
                            console.log("Skip teleport event with ".concat(eosioData.to, " as recipient and ref of ").concat(eosioData.ref));
                            return [3 /*break*/, 7];
                        }
                        // Continue this event if it was marked as removed
                        if (entry.removed) {
                            console.log("Teleport with trx hash ".concat(entry.transactionHash, " got removed and will be skipped \u274C"));
                            return [3 /*break*/, 7];
                        }
                        // Set the id as the id of the sender chain
                        if (this.version != 0 || this.config.eth.id !== undefined) {
                            eosioData.chain_id = Number(this.config.eth.id);
                        }
                        actions = [{
                                account: this.config.eos.teleportContract,
                                name: 'received',
                                authorization: [{
                                        actor: this.config.eos.oracleAccount,
                                        permission: this.config.eos.oraclePermission || 'active',
                                    }],
                                data: eosioData,
                            }];
                        return [4 /*yield*/, this.sendTransaction(actions, trxBroadcast)];
                    case 6:
                        eos_res = _b.sent();
                        if (eos_res === false) {
                            console.log("Skip sending teleport to ".concat(eosioData.to, " with ref ").concat(eosioData.ref, " and quantity of ").concat(eosioData.quantity, " \u274C"));
                        }
                        else if (eos_res === true) {
                            console.log("Oracle has already approved teleport to ".concat(eosioData.to, " with ref ").concat(eosioData.ref, " and quantity of ").concat(eosioData.quantity, " \u2714\uFE0F"));
                        }
                        else {
                            console.log("Send teleport to ".concat(eosioData.to, " with ref ").concat(eosioData.ref, " and quantity of ").concat(eosioData.quantity, ". EOSIO blocknumber ").concat(eos_res.processed.block_num, " and trx id ").concat(eos_res.transaction_id, " \u2714\uFE0F"));
                        }
                        _b.label = 7;
                    case 7: return [3 /*break*/, 3];
                    case 8: return [3 /*break*/, 15];
                    case 9:
                        e_5_1 = _b.sent();
                        e_5 = { error: e_5_1 };
                        return [3 /*break*/, 15];
                    case 10:
                        _b.trys.push([10, , 13, 14]);
                        if (!(res_2_1 && !res_2_1.done && (_a = res_2.return))) return [3 /*break*/, 12];
                        return [4 /*yield*/, _a.call(res_2)];
                    case 11:
                        _b.sent();
                        _b.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        if (e_5) throw e_5.error;
                        return [7 /*endfinally*/];
                    case 14: return [7 /*endfinally*/];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Loads a block number from a saved file if one exists or throws an error.
     * @returns a saved block number from a file
     */
    EthOracle.load_block_number_from_file = function (blocks_file) {
        return __awaiter(this, void 0, void 0, function () {
            var file_contents, block_number;
            return __generator(this, function (_a) {
                //   let block_number: string | number = 'latest'
                if (!fs_1.default.existsSync(blocks_file))
                    throw new Error('block file does not exist.');
                file_contents = fs_1.default.readFileSync(blocks_file).toString();
                if (!file_contents)
                    throw new Error('No blocks file');
                block_number = parseInt(file_contents);
                if (isNaN(block_number))
                    throw new Error('No block number in file.');
                return [2 /*return*/, block_number];
            });
        });
    };
    /**
     * Get latest block of eth blockchain
     * @returns latest block number
     */
    EthOracle.prototype.getLatestBlock = function () {
        return __awaiter(this, void 0, void 0, function () {
            var tries, block, e_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tries = 0;
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 10];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 9]);
                        return [4 /*yield*/, this.eth_api.getProvider().getBlock('latest')];
                    case 3:
                        block = _a.sent();
                        return [2 /*return*/, block.number];
                    case 4:
                        e_6 = _a.sent();
                        if (!(tries >= this.eth_api.get_EndpointAmount())) return [3 /*break*/, 5];
                        console.log('Could not get latest block by any eth endpoint ❌');
                        return [2 /*return*/, undefined];
                    case 5:
                        console.error("Could not get latest block with ".concat(this.eth_api.getEndpoint(), " \u274C"));
                        return [4 /*yield*/, this.eth_api.nextEndpoint()];
                    case 6:
                        _a.sent();
                        console.log("Try ".concat(this.eth_api.getEndpoint(), " in a second..."));
                        tries++;
                        return [4 /*yield*/, (0, helpers_1.sleep)(1000)];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8: return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 1];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Run the process of checking the eth chain for teleports and claims and store the state on ethe eosio chain
     * @param start_ref Block number to start from. String 'latest' to start from the latest block in block number file
     * @param trxBroadcast False if transactions should not be broadcasted (not submitted to the block chain)
     */
    EthOracle.prototype.run = function (start_ref, trxBroadcast, waitCycle) {
        if (trxBroadcast === void 0) { trxBroadcast = true; }
        if (waitCycle === void 0) { waitCycle = 30; }
        return __awaiter(this, void 0, void 0, function () {
            var from_block, tries, latest_block, err_1, to_block, e_7, e_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logViaBot("Starting *".concat(this.config.eth.network, "* oracle with *").concat(this.config.eos.oracleAccount, "* and ").concat(this.config.eth.oracleAccount, " \uD83C\uDFC3"), true);
                        this.running = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 29, , 31]);
                        return [4 /*yield*/, this.eth_api.nextEndpoint()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.eos_api.nextEndpoint()];
                    case 3:
                        _a.sent();
                        tries = 0;
                        _a.label = 4;
                    case 4:
                        if (!this.running) return [3 /*break*/, 28];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 22, , 26]);
                        return [4 /*yield*/, this.getLatestBlock()];
                    case 6:
                        latest_block = _a.sent();
                        if (typeof latest_block != 'number') {
                            console.error('Latest block number is not a number', latest_block);
                            return [2 /*return*/];
                        }
                        if (!!from_block) return [3 /*break*/, 12];
                        if (!(start_ref === 'latest')) return [3 /*break*/, 11];
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, EthOracle.load_block_number_from_file(this.blocks_file_name)];
                    case 8:
                        from_block = _a.sent();
                        from_block -= 50; // for fresh start go back 50 blocks
                        if (this.config.eth.genesisBlock && this.config.eth.genesisBlock > from_block) {
                            from_block = this.config.eth.genesisBlock;
                            console.log('Start by genesis block.');
                        }
                        else {
                            console.log("Starting from saved block with additional previous 50 blocks for safety: ".concat(from_block, "."));
                        }
                        return [3 /*break*/, 10];
                    case 9:
                        err_1 = _a.sent();
                        console.log('Could not get block from file ❌');
                        if (this.config.eth.genesisBlock) {
                            from_block = this.config.eth.genesisBlock;
                            console.log('Start by genesis block.');
                        }
                        else {
                            from_block = latest_block - 100; // go back 100 blocks from latest
                            console.log('Start 100 blocks before the latest block.');
                        }
                        return [3 /*break*/, 10];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        if (typeof start_ref === 'number') {
                            from_block = start_ref;
                        }
                        else {
                            from_block = this.config.eth.genesisBlock;
                        }
                        _a.label = 12;
                    case 12:
                        if (from_block < 0) {
                            from_block = 0;
                        }
                        to_block = Math.min(from_block + 100, latest_block);
                        if (!(from_block <= to_block)) return [3 /*break*/, 16];
                        console.log("Getting events from block ".concat(from_block, " to ").concat(to_block));
                        return [4 /*yield*/, this.process_claimed(from_block, to_block, trxBroadcast)];
                    case 13:
                        _a.sent();
                        return [4 /*yield*/, this.process_teleported(from_block, to_block, trxBroadcast)];
                    case 14:
                        _a.sent();
                        from_block = to_block; // In next round the current to block is the from block
                        return [4 /*yield*/, EthOracle.save_block_to_file(to_block, this.blocks_file_name)]; // Save last block received
                    case 15:
                        _a.sent(); // Save last block received
                        return [3 /*break*/, 18];
                    case 16:
                        console.log("\u26A1\uFE0F From block ".concat(from_block, " is higher than to block ").concat(to_block));
                        return [4 /*yield*/, (0, helpers_1.sleep)(10000)];
                    case 17:
                        _a.sent();
                        _a.label = 18;
                    case 18:
                        if (!(latest_block - from_block <= 1000)) return [3 /*break*/, 20];
                        return [4 /*yield*/, (0, helpers_1.WaitWithAnimation)(waitCycle, 'Wait for new blocks...')];
                    case 19:
                        _a.sent();
                        return [3 /*break*/, 21];
                    case 20:
                        console.log("Latest block is ".concat(latest_block, ". Not waiting..."));
                        _a.label = 21;
                    case 21:
                        tries = 0;
                        return [3 /*break*/, 26];
                    case 22:
                        e_7 = _a.sent();
                        console.error('⚡️ ' + e_7.message);
                        tries++;
                        if (!(tries < 12)) return [3 /*break*/, 24];
                        console.error('Try again in 5 seconds');
                        return [4 /*yield*/, (0, helpers_1.sleep)(5000)];
                    case 23:
                        _a.sent();
                        return [3 /*break*/, 25];
                    case 24: throw (e_7.message);
                    case 25: return [3 /*break*/, 26];
                    case 26: 
                    // Select the next endpoint to distribute the requests
                    return [4 /*yield*/, this.eos_api.nextEndpoint()];
                    case 27:
                        // Select the next endpoint to distribute the requests
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 28: return [3 /*break*/, 31];
                    case 29:
                        e_8 = _a.sent();
                        return [4 /*yield*/, this.logError("\u26A1\uFE0F by ".concat(this.config.eos.oracleAccount, " on ").concat(this.config.eth.network, ". ").concat(String(e_8)))];
                    case 30:
                        _a.sent();
                        return [3 /*break*/, 31];
                    case 31: return [4 /*yield*/, this.logViaBot("Thread closed of *".concat(this.config.eth.network, "* oracle with *").concat(this.config.eos.oracleAccount, "* and ").concat(this.config.eth.oracleAccount, " \uD83D\uDC80"), true)];
                    case 32:
                        _a.sent();
                        if (!this.telegram.bot) return [3 /*break*/, 34];
                        return [4 /*yield*/, (0, helpers_1.sleep)(5000)]; // Wait some seconds to finsih the sending of telegram messages for real
                    case 33:
                        _a.sent(); // Wait some seconds to finsih the sending of telegram messages for real
                        _a.label = 34;
                    case 34: return [2 /*return*/];
                }
            });
        });
    };
    EthOracle.version_v1 = {
        claimed: {
            // Claimed(uint64,address,uint256)
            decode: ['uint64', 'address', 'uint256'],
            topic: '0xf20fc6923b8057dd0c3b606483fcaa038229bb36ebc35a0040e3eaa39cf97b17',
        },
        teleport: {
            // Teleport(address,string,uint256,uint256)
            decode: ['string', 'uint256', 'uint256'],
            topic: '0x622824274e0937ee319b036740cd0887131781bc2032b47eac3e88a1be17f5d5',
        }
    };
    EthOracle.version_v2 = {
        claimed: {
            // Claimed(bytes32,address,uint256)
            decode: ['bytes32', 'address', 'uint256'],
            topic: '0x0508a8b4117d9a7b3d8f5895f6413e61b4f9a2df35afbfb41e78d0ecfff1843f',
        },
        teleport: {
            // Teleport(address,string,uint256)
            decode: ['string', 'uint256'],
            topic: '0xc8cee5634900c8bdd1ce6ab2e4fdac4d0c4cb5a3cce1c6d5f447cf84a3ddf414',
        }
    };
    EthOracle.MIN_BLOCKS_TO_WAIT = 5;
    return EthOracle;
}());
// Handle params from console
var argv = yargs_1.default
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
    .help().alias('help', 'h').argv;
// Load config and set title
var config_path = argv.config || process.env['CONFIG'] || './config';
process.title = "oracle-eth ".concat(config_path);
var configFile = require(config_path);
// Check and set start parameters
var startRef = 'latest';
if (typeof argv.block == 'number' || argv.block == 'latest') {
    startRef = argv.block;
}
else if (process.env['START_BLOCK']) {
    var start_block_env = parseInt(process.env['START_BLOCK']);
    if (isNaN(start_block_env)) {
        console.error('You must supply start block as an integer in env');
        process.exit(1);
    }
    startRef = start_block_env;
}
if (configFile.eos.epVerifications > configFile.eos.endpoints.length) {
    console.error('Error: eosio epVerifications cannot be greater than given amount of endpoints');
    process.exit(1);
}
if (configFile.eth.epVerifications > configFile.eth.endpoints.length) {
    console.error('Error: eosio epVerifications cannot be greater than given amount of endpoints');
    process.exit(1);
}
var waitCycle = undefined;
if (typeof configFile.eth.waitCycle == 'number') {
    waitCycle = configFile.eth.waitCycle;
}
if (argv.waiter) {
    waitCycle = argv.waiter;
}
// Set up the oracle
var eosSigProvider = new eosjs_jssig_1.JsSignatureProvider([configFile.eos.privateKey]);
var ethOracle = new EthOracle(configFile, eosSigProvider);
// Run the process
ethOracle.run(startRef, argv.broadcast, waitCycle);
