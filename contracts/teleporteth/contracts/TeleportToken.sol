pragma solidity ^0.8.14;
/*
 * SPDX-License-Identifier: MIT
 */
 
// Verification of externally created ECDSA signatures in Solidity: https://gist.github.com/BjornvdLaan/e41d292339bbdebb831d0b976e1804e8
contract Verify {
  function recoverSigner(bytes32 message, bytes memory sig) public pure returns (address) {
       uint8 v;
       bytes32 r;
       bytes32 s;

       (v, r, s) = splitSignature(sig);

       if (v != 27 && v != 28) {
           return (address(0));
       } else {
           // solium-disable-next-line arg-overflow
           return ecrecover(message, v, r, s);
       }
  }

  function splitSignature(bytes memory sig) public pure returns (uint8, bytes32, bytes32) {
       require(sig.length == 65);

       bytes32 r;
       bytes32 s;
       uint8 v;

       assembly {
           // first 32 bytes, after the length prefix
           r := mload(add(sig, 32))
           // second 32 bytes
           s := mload(add(sig, 64))
           // final byte (first byte of the next 32 bytes)
           v := byte(0, mload(add(sig, 96)))
       }

       if (v < 27)
           v += 27;

       return (v, r, s);
   }
}


library Endian {
    /* https://ethereum.stackexchange.com/questions/83626/how-to-reverse-byte-order-in-uint256-or-bytes32 */
    function reverse64(uint64 input) internal pure returns (uint64 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00FF00FF00) >> 8) |
            ((v & 0x00FF00FF00FF00FF) << 8);

        // swap 2-byte long pairs
        v = ((v & 0xFFFF0000FFFF0000) >> 16) |
            ((v & 0x0000FFFF0000FFFF) << 16);

        // swap 4-byte long pairs
        v = (v >> 32) | (v << 32);
    }
    function reverse32(uint32 input) internal pure returns (uint32 v) {
        v = input;

        // swap bytes
        v = ((v & 0xFF00FF00) >> 8) |
            ((v & 0x00FF00FF) << 8);

        // swap 2-byte long pairs
        v = (v >> 16) | (v << 16);
    }
    function reverse16(uint16 input) internal pure returns (uint16 v) {
        v = input;

        // swap bytes
        v = (v >> 8) | (v << 8);
    }
}

// ----------------------------------------------------------------------------
// ERC Token Standard #20 Interface
// https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md
// ----------------------------------------------------------------------------
abstract contract ERC20Interface {
    function totalSupply() virtual public view returns (uint);
    function balanceOf(address tokenOwner) virtual public view returns (uint balance);
    function allowance(address tokenOwner, address spender) virtual public view returns (uint remaining);
    function transfer(address to, uint tokens) virtual public returns (bool success);
    function approve(address spender, uint tokens) virtual public returns (bool success);
    function transferFrom(address from, address to, uint tokens) virtual public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}


// ----------------------------------------------------------------------------
// Contract function to receive approval and execute function in one call
//
// Borrowed from MiniMeToken
// ----------------------------------------------------------------------------
abstract contract ApproveAndCallFallBack {
    function receiveApproval(address from, uint256 tokens, address token, bytes memory data) virtual public;
}


// ----------------------------------------------------------------------------
// Owned contract
// ----------------------------------------------------------------------------
contract Owned {
    address public owner;
    address public newOwner;

    event OwnershipTransferred(address indexed _from, address indexed _to);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        newOwner = _newOwner;
    }

    function acceptOwnership() public {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}


contract Oracled is Owned {
    mapping(address => bool) public oracles;

    modifier onlyOracle {
        require(oracles[msg.sender] == true, "Oracle is not registered");

        _;
    }

    function regOracle(address _newOracle) public onlyOwner {
        require(!oracles[_newOracle], "Oracle is already registered");

        oracles[_newOracle] = true;
    }

    function unregOracle(address _remOracle) public onlyOwner {
        require(oracles[_remOracle] == true, "Oracle is not registered");

        delete oracles[_remOracle];
    }
}

// ----------------------------------------------------------------------------
// ERC20 Token, with the addition of symbol, name and decimals and an
// initial fixed supply, added teleport method
// ----------------------------------------------------------------------------
contract TeleportToken is ERC20Interface, Owned, Oracled, Verify {

    struct TeleportData {
        uint64 id;
        uint32 ts;
        // uint64 fromAddr;     // does not need to be interpreted
        uint64 quantity;
        // uint64 symbolRaw;    // does not need to be send
        // uint8 chainId;       // does not need to be send
        address toAddress;
        // uint64 fromContract; // does not need to be send
        bytes4 fromChainNet;
        uint8 fromChainId;
    }

    struct Chain {
        uint64 contract_name;
        bytes32 netId;
        bool active;
        uint8 chainId;
    }

    string public symbol;
    string public name;
    uint64 private _revSymbolRaw;
    uint8 public decimals;
    uint8 public threshold;
    uint8 public thisChainId;
    bool public freezedTransfer;
    bool public freezedTeleport;
    bool public freezedClaim;
    uint public _totalSupply;
    uint public minteleport;
    
    mapping(address => uint) balances;
    mapping(address => mapping(address => uint)) allowed;

    mapping(bytes32 => mapping(uint64 => mapping(address => bool))) signed;
    mapping(bytes32 => mapping(uint64 => bool)) public claimed;

    mapping(uint8 => uint64) public indexes;
    mapping(bytes32 => Chain) public chains;
    mapping(uint8 => bytes32) private chainNetId;

    event Teleport(address indexed from, string to, uint256 transferData);
    event Claimed(bytes32 chainNet, address to, uint256 transferData);

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor() {
        symbol = "SAVACT";                                  // EOSIO token symbol name
        name = "SavAct System Token";
        decimals = 4;                                       // EOSIO token symbol precision
        _totalSupply = 320000000 * (10**uint(decimals));    // Total supply of the EOSIO token. Has to be lower than 18446744073709551615 (max of uint64)
        require(_totalSupply <= 0xFFFFFFFFFFFFFFFF, "Total supply is over uint64");
        threshold = 3;
        thisChainId = 2;
        minteleport = 0;

        balances[address(0)] = _totalSupply;
        _revSymbolRaw = Endian.reverse64(string_to_symbol_c(decimals, symbol));
    }

    function addChain(bytes32 netId, uint64 contract_name, uint8 chainId, uint64 telIndex) public onlyOwner returns (bool success){
        Chain storage c = chains[bytes4(netId)];
        Chain storage cByChainId = chains[chainNetId[chainId]];
        require(!c.active, "Chain is already active");
        require(chainId != thisChainId, "Chain id is used by this chain");
        require(!cByChainId.active, "Chain id is already used");
        c.netId = netId;
        c.contract_name = contract_name;
        c.chainId = chainId;
        chainNetId[chainId] = bytes4(netId);
        require(indexes[chainId] <= telIndex, "Teleport index is already spent");
        indexes[chainId] = telIndex;
        c.active = true;
        return true;
    }

    function rmChain(bytes32 netId) public onlyOwner returns (bool success){
        Chain storage c = chains[bytes4(netId)];
        require(c.active, "Chain is not active");
        c.active = false;
        return true;
    }
    
    // ------------------------------------------------------------------------
    // Total supply is a number of tokens that currently exists and are either in circulation or locked somehow
    // ------------------------------------------------------------------------
    function totalSupply() override public view returns (uint) {
        return _totalSupply;
    }

    
    // ------------------------------------------------------------------------
    // Amount of tokens which are currently in circulation of this chain
    // ------------------------------------------------------------------------
    function chainSupply() public view returns (uint) {
        return _totalSupply - balances[address(0)];
    }

    // ------------------------------------------------------------------------
    // Get the token balance for account `tokenOwner`
    // ------------------------------------------------------------------------
    function balanceOf(address tokenOwner) override public view returns (uint balance) {
        return balances[tokenOwner];
    }


    // ------------------------------------------------------------------------
    // Get the claimed status of a teleport
    // ------------------------------------------------------------------------
    function isClaimed(uint8 chainId, uint64 index) public view returns (bool) {
        return claimed[chainNetId[chainId]][index];
    }

    // ------------------------------------------------------------------------
    // Transfer the balance from token owner's account to `to` account
    // - Owner's account must have sufficient balance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transfer(address to, uint tokens) override public returns (bool success) {
        if(freezedTransfer){
            revert();
        }
        balances[msg.sender] = balances[msg.sender] - tokens;
        balances[to] = balances[to] + tokens;
        emit Transfer(msg.sender, to, tokens);
        return true;
    }


    // ------------------------------------------------------------------------
    // Token owner can approve for `spender` to transferFrom(...) `tokens`
    // from the token owner's account
    //
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md
    // recommends that there are no checks for the approval double-spend attack
    // as this should be implemented in user interfaces
    // ------------------------------------------------------------------------
    function approve(address spender, uint tokens) override public returns (bool success) {
        allowed[msg.sender][spender] = tokens;
        emit Approval(msg.sender, spender, tokens);
        return true;
    }

    // ------------------------------------------------------------------------
    // Transfer `tokens` from the `from` account to the `to` account
    //
    // The calling account must already have sufficient tokens approve(...)-d
    // for spending from the `from` account and
    // - From account must have sufficient balance to transfer
    // - Spender must have sufficient allowance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transferFrom(address from, address to, uint tokens) override public returns (bool success) {
        balances[from] = balances[from] - tokens;
        allowed[from][msg.sender] = allowed[from][msg.sender] - tokens;
        balances[to] = balances[to] + tokens;
        emit Transfer(from, to, tokens);
        return true;
    }


    // ------------------------------------------------------------------------
    // Returns the amount of tokens approved by the owner that can be
    // transferred to the spender's account
    // ------------------------------------------------------------------------
    function allowance(address tokenOwner, address spender) override public view returns (uint remaining) {
        return allowed[tokenOwner][spender];
    }


    // ------------------------------------------------------------------------
    // Token owner can approve for `spender` to transferFrom(...) `tokens`
    // from the token owner's account. The `spender` contract function
    // `receiveApproval(...)` is then executed
    // ------------------------------------------------------------------------
    function approveAndCall(address spender, uint tokens, bytes memory data) public returns (bool success) {
        allowed[msg.sender][spender] = tokens;
        emit Approval(msg.sender, spender, tokens);
        ApproveAndCallFallBack(spender).receiveApproval(msg.sender, tokens, address(this), data);
        return true;
    }


    // ------------------------------------------------------------------------
    // Moves tokens to the inaccessible account and then sends event for the oracles
    // to monitor and issue on other chain
    // to : EOS address
    // tokens : number of tokens in satoshis
    // chainId : The chain id that they will be sent to
    // ------------------------------------------------------------------------
    function teleport(string memory to, uint tokens, uint8 chainid) public returns (bool success) {
        if(freezedTeleport){
            revert();
        }
        require(minteleport <= tokens, "Token amount is to low");

        balances[msg.sender] = balances[msg.sender] - tokens;
        balances[address(0)] = balances[address(0)] + tokens;
        emit Transfer(msg.sender, address(0), tokens);
        uint256 extraParams = uint256(_revSymbolRaw) | (uint256(indexes[chainid])<< 64) | (uint256(chainid) << 128);
        emit Teleport(msg.sender, to, tokens | (extraParams << 64));
        indexes[chainid]++;

        return true;
    }


    // ------------------------------------------------------------------------
    // Claim tokens sent using signatures supplied to the other chain
    // ------------------------------------------------------------------------
    function verifySigData(bytes memory sigData) private returns (TeleportData memory) {
        TeleportData memory td;

        uint64 id;
        uint32 ts;
        uint64 fromAddr;
        uint64 quantity;
        uint64 symbolRaw;
        uint8 chainId;
        uint64 fromContract;
        uint32 fromChainNet;
        address toAddress;

        assembly {
            id := mload(add(add(sigData, 0x8), 0))
            ts := mload(add(add(sigData, 0x4), 8))
            fromAddr := mload(add(add(sigData, 0x8), 12))
            quantity := mload(add(add(sigData, 0x8), 20))
            symbolRaw := mload(add(add(sigData, 0x8), 28))
            chainId := mload(add(add(sigData, 0x1), 36))
            fromContract := mload(add(add(sigData, 0x8), 37))
            fromChainNet := mload(add(add(sigData, 0x4), 45))      
            toAddress := mload(add(add(sigData, 0x14), 49))
        }

        td.id = Endian.reverse64(id);
        td.ts = Endian.reverse32(ts);
        td.quantity = Endian.reverse64(quantity);
        td.toAddress = toAddress;
        td.fromChainNet = bytes4(fromChainNet);

        require(thisChainId == chainId, "Invalid chain id");
        require(block.timestamp < td.ts + (60 * 60 * 24 * 30), "Teleport has expired");
        require(symbolRaw == _revSymbolRaw, "Invalid token");
        
        Chain storage c = chains[td.fromChainNet];
        require(c.active, "Invalid sender net id");
        require(c.contract_name == fromContract, "Invalid sender contract name");

        require(!claimed[td.fromChainNet][td.id], "Already claimed");

        td.fromChainId = c.chainId;
        claimed[td.fromChainNet][td.id] = true;

        return td;
    }
    
    // ------------------------------------------------------------------------
    // Convert symbol parameters to EOSIO SymbolRaw
    // https://github.com/EOSIO/eos/blob/master/libraries/chain/include/eosio/chain/symbol.hpp
    // ------------------------------------------------------------------------
    function string_to_symbol_c(uint8 precision, string storage str) private view returns (uint64) {
        bytes storage strbytes = bytes(str);
        uint32 len = uint32(strbytes.length);

        uint64 result;
        for (uint32 i = 0; i < len; ++i) {
            result |= (uint64(uint8(strbytes[i])) << (8*(1+i)));
        }

        result |= uint64(precision);
        return result;
    }

    function claim(bytes memory sigData, bytes[] calldata signatures) public returns (address toAddress) {
        
        if(freezedClaim){
            revert();
        }

        TeleportData memory td = verifySigData(sigData);

        // Verify signatures
        require(sigData.length == 81, "Wrong size of signature data");
        require(signatures.length <= 10, "Too many signatures");

        bytes32 message = keccak256(sigData);

        uint8 numberSigs = 0;

        for (uint8 i = 0; i < signatures.length; i++){
            address potential = Verify.recoverSigner(message, signatures[i]);

            // Check that they are oracles which are registered and haven't signed twice
            if (oracles[potential] && !signed[td.fromChainNet][td.id][potential]){
                signed[td.fromChainNet][td.id][potential] = true;
                numberSigs++;
            }
        }

        require(numberSigs >= threshold, "Not enough valid signatures");

        balances[address(0)] = balances[address(0)] - td.quantity;
        balances[td.toAddress] = balances[td.toAddress] + td.quantity;
        emit Transfer(address(0), td.toAddress, td.quantity);
        uint256 extraParams = uint256(_revSymbolRaw) | (uint256(td.id) << 64) |  (uint256(td.fromChainId) << 128);
        emit Claimed(td.fromChainNet, td.toAddress, td.quantity | extraParams << 64);

        return td.toAddress;
    }

    function freeze(bool freezeclaim, bool freezteleport, bool freezetransfer) public onlyOwner returns (bool success) {
        freezedClaim = freezeclaim;
        freezedTeleport = freezteleport;
        freezedTransfer = freezetransfer;

        return true;
    }

    function updateThreshold(uint8 newThreshold) public onlyOwner returns (bool success) {
        require(newThreshold > 0, "Minimum threshold is 1");
        require(newThreshold <= 10, "Maximum threshold is 10");
        require(newThreshold != threshold, "No new value for threshold");

        threshold = newThreshold;

        return true;
    }

    function updateChainId(uint8 newChainId) public onlyOwner returns (bool success) {
        require(newChainId > 0, "Chain id is too low");
        require(newChainId < 255, "Chain id is too big");
        require(newChainId != thisChainId, "No new value for chain id");
        thisChainId = newChainId;

        return true;
    }

    function setMin(uint min) public onlyOwner returns (bool success) {
        minteleport = min;
        return true;
    }

    // ------------------------------------------------------------------------
    // Don't accept ETH
    // ------------------------------------------------------------------------
    receive () external payable {
        revert();
    }


    // ------------------------------------------------------------------------
    // Owner can transfer out any accidentally sent ERC20 tokens
    // ------------------------------------------------------------------------
    function transferAnyERC20Token(address tokenAddress, uint tokens) public onlyOwner returns (bool success) {
        return ERC20Interface(tokenAddress).transfer(owner, tokens);
    }
}