pragma solidity ^0.8.13;
/*
 * SPDX-License-Identifier: MIT
 */
pragma experimental ABIEncoderV2;

// Erläutrerung: https://gist.github.com/BjornvdLaan/e41d292339bbdebb831d0b976e1804e8
contract Verify {
    // //-
    // function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
    //     if (_i == 0) {
    //         return "0";
    //     }
    //     uint j = _i;
    //     uint len;
    //     while (j != 0) {
    //         len++;
    //         j /= 10;
    //     }
    //     bytes memory bstr = new bytes(len);
    //     uint k = len;
    //     while (_i != 0) {
    //         k = k-1;
    //         uint8 temp = (48 + uint8(_i - _i / 10 * 10));
    //         bytes1 b1 = bytes1(temp);
    //         bstr[k] = b1;
    //         _i /= 10;
    //     }
    //     return string(bstr);
    // }
    // //-
    // function toString(address account) public pure returns(string memory) {
    //     return toString(abi.encodePacked(account));
    // }
    // //-
    // function toString(uint256 value) public pure returns(string memory) {
    //     return toString(abi.encodePacked(value));
    // }
    // //-
    // function toString(bytes32 value) public pure returns(string memory) {
    //     return toString(abi.encodePacked(value));
    // }
    // //-
    // function toString(bytes memory data) public pure returns(string memory) {
    //     bytes memory alphabet = "0123456789abcdef";

    //     bytes memory str = new bytes(2 + data.length * 2);
    //     str[0] = "0";
    //     str[1] = "x";
    //     for (uint i = 0; i < data.length; i++) {
    //         str[2+i*2] = alphabet[uint(uint8(data[i] >> 4))];
    //         str[3+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
    //     }
    //     return string(str);
    // }

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
        require(oracles[msg.sender] == true, "Account is not a registered oracle");

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

    string public symbol;
    string public  name;
    uint8 public decimals;
    uint8 public threshold;
    uint8 public thisChainId;
    uint public _totalSupply;
    //- add code
    address public swapTokenAddress;
    mapping(uint8 => uint64) public indexes;
    //- end add

    mapping(address => uint) balances;
    mapping(address => mapping(address => uint)) allowed;

    mapping(uint64 => mapping(address => bool)) signed;
    mapping(uint64 => bool) public claimed;

    event Teleport(address indexed from, string to, uint tokens, uint8 chainId, uint64 index);
    event Claimed(uint64 id, address to, uint tokens);

    struct TeleportData {
        uint64 id;
        uint32 ts;
        uint64 fromAddr;
        uint64 quantity;
        uint64 symbolRaw;
        uint8 chainId;
        address toAddress;
    }

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------
    constructor() {
        symbol = "TLM";
        name = "Alien Worlds Trilium";
        decimals = 4;
        _totalSupply = 10000000000 * 10**uint(decimals);
        balances[address(0)] = _totalSupply;
        threshold = 3;
        thisChainId = 2;

        //- add code
        swapTokenAddress = 0xB84cBbF09b3Ed388a45cD875ebba41a20365e6e7; //- test
        //- end add
    }


    // ------------------------------------------------------------------------
    // Total supply
    // ------------------------------------------------------------------------
    function totalSupply() override public view returns (uint) {
        return _totalSupply - balances[address(0)];
    }


    // ------------------------------------------------------------------------
    // Get the token balance for account `tokenOwner`
    // ------------------------------------------------------------------------
    function balanceOf(address tokenOwner) override public view returns (uint balance) {
        return balances[tokenOwner];
    }


    // ------------------------------------------------------------------------
    // Transfer the balance from token owner's account to `to` account
    // - Owner's account must have sufficient balance to transfer
    // - 0 value transfers are allowed
    // ------------------------------------------------------------------------
    function transfer(address to, uint tokens) override public returns (bool success) {
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
        //- replace
        balances[msg.sender] = balances[msg.sender] - tokens;
        balances[address(0)] = balances[address(0)] + tokens;
        emit Transfer(msg.sender, address(0), tokens);
        emit Teleport(msg.sender, to, tokens, chainid, indexes[chainid]);
        indexes[chainid] = indexes[chainid] + 1;
        //- with
        // ERC20Interface(swapTokenAddress).transferFrom(msg.sender, address(this), tokens);
        // balances[msg.sender] = balances[msg.sender].add(tokens);
        // emit Teleport(msg.sender, to, tokens, chainid, teleportId++); 
        //- end replace

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
        address toAddress;

        assembly {
            id := mload(add(add(sigData, 0x8), 0))
            ts := mload(add(add(sigData, 0x4), 8))
            fromAddr := mload(add(add(sigData, 0x8), 12))
            quantity := mload(add(add(sigData, 0x8), 20))
            symbolRaw := mload(add(add(sigData, 0x8), 28))
            chainId := mload(add(add(sigData, 0x1), 36))
            toAddress := mload(add(add(sigData, 0x14), 37))
            //- Never use an oracle account for two contracts the contract name should be signed, too.
        }

        td.id = Endian.reverse64(id);
        td.ts = Endian.reverse32(ts);
        td.fromAddr = Endian.reverse64(fromAddr);
        td.quantity = Endian.reverse64(quantity);
        td.symbolRaw = Endian.reverse64(symbolRaw);
        td.chainId = chainId;
        td.toAddress = toAddress;

        require(thisChainId == td.chainId, "Invalid Chain ID");
        require(block.timestamp < td.ts + (60 * 60 * 24 * 30), "Teleport has expired");

        require(!claimed[td.id], "Already Claimed");

        claimed[td.id] = true;

        return td;
    }

    function claim(bytes memory sigData, bytes[] calldata signatures) public returns (address toAddress) {
        TeleportData memory td = verifySigData(sigData);

        // verify signatures
        require(sigData.length == 69, "Signature data is the wrong size");
        require(signatures.length <= 10, "Maximum of 10 signatures can be provided");

        bytes32 message = keccak256(sigData);

        uint8 numberSigs = 0;

        for (uint8 i = 0; i < signatures.length; i++){
            address potential = Verify.recoverSigner(message, signatures[i]);

            // Check that they are an oracle and they haven't signed twice
            if (oracles[potential] && !signed[td.id][potential]){       //- This !signed[td.id][potential] should be within this condition, otherwise numberSigs will never be reached if one oragle changed before other has signed
                signed[td.id][potential] = true;
                numberSigs++;

                if (numberSigs >= 10){  //- Never happens, because i < signatures.length <= 10
                    break;
                }
            }
        }

        require(numberSigs >= threshold, "Not enough valid signatures provided");

        //- replace
        balances[address(0)] = balances[address(0)] - td.quantity;
        balances[td.toAddress] = balances[td.toAddress] + td.quantity;
        emit Transfer(address(0), td.toAddress, td.quantity);
        
        //- with
        // balances[msg.sender] = balances[msg.sender].sub(td.quantity);
        // ERC20Interface(swapTokenAddress).transfer(msg.sender, td.quantity);
        //- end replace

        emit Claimed(td.id, td.toAddress, td.quantity);

        return td.toAddress;
    }

    function updateThreshold(uint8 newThreshold) public onlyOwner returns (bool success) {
        if (newThreshold > 0){
            require(newThreshold <= 10, "Threshold has maximum of 10");

            threshold = newThreshold;

            return true;
        }

        return false;
    }

    function updateChainId(uint8 newChainId) public onlyOwner returns (bool success) {
        if (newChainId > 0){
            require(newChainId <= 100, "ChainID is too big");
            thisChainId = newChainId;

            return true;
        }

        return false;
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
        return ERC20Interface(tokenAddress).transfer(owner, tokens); //- owner should be replaced by a recipient which whould be one of the parameters, or not?
    }
}
