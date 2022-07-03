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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesManager = void 0;
var helpers_1 = require("../scripts/helpers");
var TelegramMesseger_1 = require("./TelegramMesseger");
var ResourcesManager = /** @class */ (function () {
    /**
     *
     * @param config_powerup Config data to buy resources automatically
     * @param eosio Config data of eosio network
     * @param telegram Telegram messenger object
     * @param eos_api EOSIO API object
     */
    function ResourcesManager(config_powerup, eosio, telegram, eos_api) {
        this.config_powerup = config_powerup;
        this.eosio = eosio;
        this.telegram = telegram;
        // Object to store the remaining system tokens per day
        this.dayCalculator = {
            currentCosts: BigInt(0),
            fromTime: 0,
            max_payment: { amount: BigInt(0), symbol: { name: '', precision: 0 } }
        };
        this.account_name = '';
        this.permission = 'active';
        this.maxBorrowDuration = (24 * 60 * 60 * 1000) - (30 * 60 * 1000); // have to be less than 24h
        if (config_powerup) {
            this.account_name = eosio.oracleAccount;
            if (eosio.oraclePermission) {
                this.permission = eosio.oraclePermission;
            }
            // Check some config data
            var asset = (0, helpers_1.stringToAsset)(config_powerup.max_payment);
            if (asset.amount != BigInt(0) && typeof asset.symbol.precision != 'number' && asset.symbol.name.length > 0) {
                throw ('Wrong definition of lend.max_payment');
            }
            // Further checks if it is the EOS network
            if (eosio.netId == 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906') {
                if (config_powerup.contract != 'eosio') {
                    throw ('Wrong powerup contract');
                }
                if (config_powerup.paymenttoken != 'eosio.token') {
                    throw ('Wrong system token symbol for powerup');
                }
                if (asset.symbol.name != 'EOS') {
                    throw ('Wrong token symbol of powerup.max_payment');
                }
                if (asset.symbol.precision != 4) {
                    throw ('Wrong token precision of powerup.max_payment');
                }
            }
            this.dayCalculator.max_payment = asset;
            if (this.config_powerup) {
                this.config_powerup.cpu = typeof this.config_powerup.cpu ? Number(this.config_powerup.cpu) : 0;
                this.config_powerup.net = typeof this.config_powerup.net ? Number(this.config_powerup.net) : 0;
            }
        }
        // Set the initial last borrowing time. It is in one tenth of the time after the initial start.
        // This prevents the loan of new resources over and over again if the oracle keeps crashing at the beginning.
        var toTenthDuration = Date.now() - Math.round((9 * this.maxBorrowDuration) / 10);
        this.cpu = {
            available: 0,
            lastLend: toTenthDuration
        };
        this.net = {
            available: 0,
            lastLend: toTenthDuration
        };
    }
    ResourcesManager.prototype.isManager = function () {
        return this.config_powerup ? true : false;
    };
    ResourcesManager.prototype.check = function (eos_api) {
        return __awaiter(this, void 0, void 0, function () {
            var result, rentCPU, rentNET;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.config_powerup) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, eos_api.getRPC().get_account(this.account_name)];
                    case 1:
                        result = _a.sent();
                        this.cpu.available = result.cpu_limit.available;
                        this.net.available = result.net_limit.available;
                        rentCPU = this.cpu.available < this.config_powerup.min_cpu;
                        rentNET = this.net.available < this.config_powerup.min_net;
                        this.borrow(eos_api, rentCPU, rentNET);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Borrow resources
     * @param eos_api Eosio API
     * @param cpu True to borrow CPU
     * @param net True to borrow NET
     */
    ResourcesManager.prototype.borrow = function (eos_api, cpu, net) {
        if (cpu === void 0) { cpu = false; }
        if (net === void 0) { net = false; }
        return __awaiter(this, void 0, void 0, function () {
            var powerup, max_payment, symbol, balances, balance, assetBefore, cpu_us, net_bytes, fracs, cpu_frac, net_frac, action, result, powerUpResult, dateNow, paid, payment, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.config_powerup) {
                            return [2 /*return*/];
                        }
                        if (!cpu && !net) {
                            return [2 /*return*/];
                        }
                        powerup = this.config_powerup;
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
                        return [4 /*yield*/, this.telegram.logCosts("\uD83D\uDEAB Max tokens per day is not enough to borrow ".concat(cpu ? 'CPU ' : '').concat(cpu && net ? 'and ' : '').concat(net ? 'NET ' : '', " by ").concat(TelegramMesseger_1.TgM.sToMd(this.account_name), " on ").concat(TelegramMesseger_1.TgM.sToMd(this.eosio.network)), true, true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                    case 2:
                        _a.trys.push([2, 10, , 12]);
                        return [4 /*yield*/, eos_api.getRPC().get_currency_balance(this.config_powerup.paymenttoken, this.account_name, this.dayCalculator.max_payment.symbol.name)];
                    case 3:
                        balances = (_a.sent());
                        if (balances.length == 0) {
                            throw 'Account has no system token entry';
                        }
                        balance = balances[0];
                        assetBefore = (0, helpers_1.stringToAsset)(balance);
                        if (assetBefore.symbol.name != this.dayCalculator.max_payment.symbol.name) {
                            throw 'Balance has wrong symbol';
                        }
                        if (assetBefore.amount == BigInt(0)) {
                            throw 'No more system tokens available';
                        }
                        if (!(assetBefore.amount <= this.dayCalculator.max_payment.amount)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.telegram.logCosts("\uD83D\uDEA8 System tokens are running out by ".concat(TelegramMesseger_1.TgM.sToMd(this.account_name), " on ").concat(TelegramMesseger_1.TgM.sToMd(this.eosio.network), ", ").concat(TelegramMesseger_1.TgM.sToMd(balance), " remain"), true, true)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        cpu_us = typeof powerup.cpu ? Number(powerup.cpu) : 0;
                        net_bytes = typeof powerup.net ? Number(powerup.net) : 0;
                        fracs = { cpu: 0, net: 0 };
                        if (!(powerup.cpu_frac == undefined || powerup.net_frac == undefined)) return [3 /*break*/, 7];
                        return [4 /*yield*/, ResourcesManager.calcFrecs(eos_api, cpu_us, net_bytes)];
                    case 6:
                        fracs = _a.sent();
                        _a.label = 7;
                    case 7:
                        cpu_frac = cpu ? (powerup.cpu_frac !== undefined ? powerup.cpu_frac : fracs.cpu) : 0;
                        net_frac = net ? (powerup.net_frac !== undefined ? powerup.net_frac : fracs.net) : 0;
                        action = {
                            account: this.config_powerup.contract,
                            name: 'powerup',
                            authorization: [{
                                    actor: this.account_name,
                                    permission: this.permission || 'active',
                                }],
                            data: {
                                cpu_frac: cpu_frac,
                                net_frac: net_frac,
                                days: powerup.days,
                                max_payment: (0, helpers_1.assetdataToString)(max_payment, symbol.name, symbol.precision),
                                payer: this.account_name,
                                receiver: this.account_name
                            },
                        };
                        return [4 /*yield*/, eos_api.getAPI().transact({
                                actions: [action]
                            }, {
                                blocksBehind: 3,
                                expireSeconds: 30,
                            })];
                    case 8:
                        result = _a.sent();
                        powerUpResult = ResourcesManager.getPowerUpResult(result);
                        dateNow = Date.now() // Use the exact same date for cpu and net
                        ;
                        if (cpu) {
                            this.cpu.lastLend = dateNow;
                        }
                        if (net) {
                            this.net.lastLend = dateNow;
                        }
                        paid = void 0;
                        if (powerUpResult) {
                            paid = String(powerUpResult.fee);
                            payment = (0, helpers_1.stringToAsset)(paid);
                            this.dayCalculator.currentCosts += payment.amount;
                        }
                        else {
                            paid = 'an unkown amount of tokens';
                        }
                        return [4 /*yield*/, this.telegram.logCosts("Borrowed ".concat(cpu ? 'CPU ' : '').concat(cpu && net ? 'and ' : '').concat(net ? 'NET ' : '', "for ").concat(TelegramMesseger_1.TgM.sToMd(paid), " by ").concat(TelegramMesseger_1.TgM.sToMd(this.account_name), " on ").concat(TelegramMesseger_1.TgM.sToMd(this.eosio.network)), true, true)];
                    case 9:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 10:
                        e_1 = _a.sent();
                        return [4 /*yield*/, this.telegram.logError("\u26A1\uFE0F by ".concat(this.account_name, " on ").concat(this.eosio.network, " \n").concat(String(e_1)))];
                    case 11:
                        _a.sent();
                        return [2 /*return*/, false];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get power up result from a transaction result
     * @param trxResult Transaction result of a powerup action
     * @returns paid fee, powup_net and powup_cpu otherwise undefined
     */
    ResourcesManager.getPowerUpResult = function (trxResult) {
        if ('processed' in trxResult && 'action_traces' in trxResult.processed && trxResult.processed.action_traces.length > 0) {
            for (var _i = 0, _a = trxResult.processed.action_traces; _i < _a.length; _i++) {
                var act_traces = _a[_i];
                if ('act' in act_traces && act_traces.act.account == 'eosio' && act_traces.act.name == 'powerup') {
                    for (var _b = 0, _c = act_traces.inline_traces; _b < _c.length; _b++) {
                        var in_trace = _c[_b];
                        if ('act' in in_trace && in_trace.act.account == 'eosio.reserv', in_trace.act.name == 'powupresult') {
                            if ('fee' in in_trace.act.data && 'powup_net' in in_trace.act.data && 'powup_cpu' in in_trace.act.data) {
                                return in_trace.act.data;
                            }
                        }
                    }
                }
            }
        }
        return undefined;
    };
    /**
     * Check to borrow resources before the lending time of old loan is over
     * @param eos_api Eosio API
     */
    ResourcesManager.prototype.checkBorrowTimeOut = function (eos_api) {
        return __awaiter(this, void 0, void 0, function () {
            var dateNow, cpu, net, tries, worked, timeshift;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dateNow = Date.now();
                        cpu = (dateNow - this.cpu.lastLend) >= this.maxBorrowDuration;
                        net = (dateNow - this.net.lastLend) >= this.maxBorrowDuration;
                        if (!(cpu || net)) return [3 /*break*/, 7];
                        tries = 0;
                        worked = false;
                        _a.label = 1;
                    case 1:
                        if (!(tries < eos_api.endpointList.length && worked === false)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.borrow(eos_api, cpu, net)];
                    case 2:
                        worked = _a.sent();
                        tries++;
                        return [4 /*yield*/, eos_api.nextEndpoint()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, helpers_1.sleep)(5000)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 1];
                    case 5:
                        if (!(worked === false)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.telegram.logError("\uD83D\uDEA8 *".concat(TelegramMesseger_1.TgM.sToMd(this.account_name), "* on *").concat(TelegramMesseger_1.TgM.sToMd(this.eosio.network), "* will give up to try to lend resources for an hour"), true, true)
                            // Disable lendig for an hour
                        ];
                    case 6:
                        _a.sent();
                        timeshift = (dateNow - this.maxBorrowDuration) + 3600000;
                        this.cpu.lastLend = timeshift;
                        this.net.lastLend = timeshift;
                        _a.label = 7;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    ResourcesManager.resource_to_frac = function (amount, limit, weight) {
        var day_limit = limit * ResourcesManager.BlocksPerDay * ResourcesManager.BNPrecision;
        var usage = Math.ceil(day_limit / weight);
        var frac = Math.floor((amount / Number(usage)) * ResourcesManager.BNPrecision) / weight;
        return Math.floor(frac * Math.pow(10, 15));
    };
    ResourcesManager.getPowerUpState = function (eos_api) {
        return __awaiter(this, void 0, void 0, function () {
            var tries, result, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tries = 0;
                        _a.label = 1;
                    case 1:
                        if (!(tries < eos_api.endpointList.length)) return [3 /*break*/, 8];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 7]);
                        return [4 /*yield*/, eos_api.getRPC().get_table_rows({
                                json: true,
                                code: 'eosio',
                                table: 'powup.state'
                                // Use no scope, "eosio" as scope will not work.
                            })];
                    case 3:
                        result = _a.sent();
                        if ('rows' in result && result.rows.length > 0) {
                            return [2 /*return*/, result.rows[0]];
                        }
                        return [3 /*break*/, 7];
                    case 4:
                        e_2 = _a.sent();
                        console.log("Error on getting entries from powup.state by ".concat(eos_api.getEndpoint()), e_2);
                        return [4 /*yield*/, eos_api.nextEndpoint()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, helpers_1.sleep)(1000)];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 7:
                        tries++;
                        return [3 /*break*/, 1];
                    case 8: throw ('No entries of powup.state found');
                }
            });
        });
    };
    /**
     * Calculate frac parameters of EOSIO power up action by micro seconds of CPU and byte amount of NET
     * @param eos_api EOSIO API
     * @param cpu_us Amount of CPU to lend
     * @param net_byte Amount of NET to lend
     * @returns cpu_frac and net_frac
     */
    ResourcesManager.calcFrecs = function (eos_api, cpu_us, net_byte) {
        return __awaiter(this, void 0, void 0, function () {
            var state, info;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ResourcesManager.getPowerUpState(eos_api)];
                    case 1:
                        state = _a.sent();
                        if (state.version != 0) {
                            throw ('Error wrong version of power up state');
                        }
                        info = eos_api.get_lastInfo();
                        if (info == null) {
                            return [2 /*return*/, { cpu: 0, net: 0 }];
                        }
                        return [2 /*return*/, {
                                cpu: cpu_us == 0 ? 0 : ResourcesManager.resource_to_frac(cpu_us, info.block_cpu_limit, Number(state.cpu.weight)),
                                net: net_byte == 0 ? 0 : ResourcesManager.resource_to_frac(net_byte, info.block_net_limit, Number(state.net.weight))
                            }];
                }
            });
        });
    };
    ResourcesManager.BNPrecision = 1000000;
    ResourcesManager.BlocksPerDay = 2 * 24 * 60 * 60;
    return ResourcesManager;
}());
exports.ResourcesManager = ResourcesManager;
