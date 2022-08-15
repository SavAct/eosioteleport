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
exports.save_number_to_file = exports.load_number_from_file = exports.WaitWithAnimation = exports.stringToAsset = exports.assetToString = exports.assetdataToString = exports.hexToString = exports.sleep = exports.fromHexString = exports.toHexString = void 0;
var fs_1 = __importDefault(require("fs"));
/**
 * Convert an Uint8Array to an hex in string format
 * @param bytes Uint8Array
 * @returns Hex in string format
 */
var toHexString = function (bytes) {
    return bytes.reduce(function (str, byte) { return str + byte.toString(16).padStart(2, '0'); }, '');
};
exports.toHexString = toHexString;
/**
 * Convert a hex in string format to an Uint8Array
 * @param hexString Hex in string format
 * @returns Uint8Array
 */
var fromHexString = function (hexString) {
    var str = hexString.match(/.{1,2}/g);
    return str == null ? new Uint8Array() : new Uint8Array(str.map(function (byte) { return parseInt(byte, 16); }));
};
exports.fromHexString = fromHexString;
/**
 * Use this function with await to let the thread sleep for the defined amount of time
 * @param ms Milliseconds
 */
var sleep = function (ms) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve) {
                setTimeout(resolve, ms);
            })];
    });
}); };
exports.sleep = sleep;
/**
 * Convert a hex string into a string
 * @param hexString
 * @returns
 */
function hexToString(hexString) {
    var reg = hexString.match(/.{1,2}/g);
    var str = '';
    if (reg != null) {
        for (var _i = 0, reg_1 = reg; _i < reg_1.length; _i++) {
            var byte = reg_1[_i];
            var char = String.fromCharCode(parseInt(byte, 16));
            if (char == '\x00') {
                break;
            }
            str += char;
        }
    }
    return str;
}
exports.hexToString = hexToString;
/**
 * Convert the data of an asset to a string
 * @param amount
 * @param symbol_name
 * @param precision
 * @returns
 */
var assetdataToString = function (amount, symbol_name, precision) {
    var s = amount.toString().padStart(precision, '0');
    var p = s.length - precision;
    var int = s.substring(0, p);
    return "".concat(int ? int : '0').concat('.').concat(s.substring(p), " ").concat(symbol_name);
};
exports.assetdataToString = assetdataToString;
/**
 * Convert the data of an asset to a string
 * @param asset
 * @returns
 */
var assetToString = function (asset) {
    return (0, exports.assetdataToString)(asset.amount, asset.symbol.name, asset.symbol.precision);
};
exports.assetToString = assetToString;
/**
 * Convert a string to an asset object
 * @param asset_str
 * @returns
 */
var stringToAsset = function (asset_str) {
    if (typeof asset_str != 'string') {
        throw "Asset string is not defined";
    }
    var s = asset_str.indexOf('.');
    if (s == -1) {
        throw "Missing precision of asset string: ".concat(asset_str);
    }
    var e = asset_str.indexOf(' ', s);
    if (e == -1) {
        throw "Missing symbol of asset string: ".concat(asset_str);
    }
    var precision = e - s - 1;
    var name = asset_str.substring(e + 1).trim();
    var amount = BigInt(asset_str.substring(0, s) + asset_str.substring(s + 1, e));
    return { amount: amount, symbol: { precision: precision, name: name } };
};
exports.stringToAsset = stringToAsset;
/**
 * Wait for a defined amount of time and show remaining seconds if the log output is a teletypewriter (editable console)
 * @param s Seconds to wait
 */
var WaitWithAnimation = function (s, info) {
    if (info === void 0) { info = ''; }
    return __awaiter(void 0, void 0, void 0, function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!process.stdout.isTTY) return [3 /*break*/, 5];
                    process.stdout.write(info + '\n\x1b[?25l');
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < s)) return [3 /*break*/, 4];
                    process.stdout.write("\uD83D\uDCA4 ".concat(i, " s / ").concat(s, " s \uD83D\uDCA4"));
                    return [4 /*yield*/, (0, exports.sleep)(1000)];
                case 2:
                    _a.sent();
                    process.stdout.write('\r\x1b[K');
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4:
                    process.stdout.moveCursor(0, -1); // up one line
                    process.stdout.clearLine(1); // from cursor to end
                    return [3 /*break*/, 7];
                case 5:
                    console.log(info);
                    return [4 /*yield*/, (0, exports.sleep)(s * 1000)];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7: return [2 /*return*/];
            }
        });
    });
};
exports.WaitWithAnimation = WaitWithAnimation;
/**
 * Load a number from file if it exists
 * @param file Path with name of the file
 * @returns a saved id number otherwise throw an error
 */
var load_number_from_file = function (file) { return __awaiter(void 0, void 0, void 0, function () {
    var file_contents, block_number;
    return __generator(this, function (_a) {
        //   let block_number: string | number = 'latest'
        if (!fs_1.default.existsSync(file)) {
            throw new Error('File does not exist');
        }
        file_contents = fs_1.default.readFileSync(file).toString();
        if (!file_contents)
            throw new Error('No content in file');
        block_number = parseInt(file_contents);
        if (isNaN(block_number))
            throw new Error('No number in file');
        return [2 /*return*/, block_number];
    });
}); };
exports.load_number_from_file = load_number_from_file;
/**
 * Save a number to a file
 * @param num Number which should be stored
 * @param file Name of the file
 */
var save_number_to_file = function (num, file) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        fs_1.default.writeFileSync(file, num.toString());
        return [2 /*return*/];
    });
}); };
exports.save_number_to_file = save_number_to_file;
