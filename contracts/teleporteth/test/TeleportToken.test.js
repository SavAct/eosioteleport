// Note: There is no sufficient typescript support for truffle tests now

const TeleportToken = artifacts.require("TeleportToken")
const ethUtil = require('ethereumjs-util')
const eosjs = require('eosjs')
const ecc = require('eosjs-ecc')
const { TextDecoder, TextEncoder } = require('text-encoding')

const catchRevert = require("./exceptions.js").catchRevert

function generateAllKeys(ethPrivateKey){
  let ethPrivate = Buffer.from(ethPrivateKey, 'hex')
  if(!ethUtil.isValidPrivate(ethPrivate)){
    throw("Invalid private key: " + ethPrivateKey)
  }
  let ethAddress = '0x' + ethUtil.privateToAddress(ethPrivate).toString('hex')
	let ethPublic = ethUtil.privateToPublic(ethPrivate).toString('hex')

	// Create EOS keys
	// let eosWIF = ecc.PrivateKey(Buffer.from(ethPrivate, 'hex')).toWif()
	let eosioPrivate = ecc.PrivateKey(ethPrivate)
	let eosioPublic = ecc.privateToPublic(eosioPrivate)

  return {ethPrivate, ethPublic, ethAddress, eosioPrivate, eosioPublic }
}

function getEosioAccountValue(name){
  const sb = new eosjs.Serialize.SerialBuffer({
    textEncoder: new TextEncoder,
    textDecoder: new TextDecoder
  })
  sb.pushName(name)
  return BigInt('0x' + toHexString(sb.array.slice(0, 8)))
}

function serializeEosioTeleport(data){
  const sb = new eosjs.Serialize.SerialBuffer({
    textEncoder: new TextEncoder,
    textDecoder: new TextDecoder
  })
  sb.pushNumberAsUint64(data.id)
  sb.pushUint32(data.timestamp)
  sb.pushName(data.from)
  sb.pushAsset(data.quantity)
  sb.push(data.chain_id)
  sb.pushName(data.eosio_contract)
  sb.pushUint8ArrayChecked(fromHexString(data.eosio_id.substring(0, 8)), 4)
  sb.pushArray(fromHexString(data.eth_address))
  return '0x' + toHexString(sb.array.slice(0, 81))
}

// Note: The following keys are public. Use them only for testings!
const TestSettings = {
  EOSIO: {
    contract_name: 'custombridge',
    netId: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473' 
  },
  Token: {
    symbol: 'SAVACT',
    totalSupply: 100000000000000,
    decimals: 4,
  },
  threshold: 3,
  chainId: 2,
  oracles: [{
    eosio_name: 'klausklaus12',
    keys: generateAllKeys('8940fbd7806ec09af7e1ceaf7ccac80e89eeeb1e85cee42f84c07b1d5a378100'),
  }, {
    eosio_name: 'anneliese',
    keys: generateAllKeys('fef658def915544a10ca323e6b4f33a6179043e1862a522c20837fb87869e668'),
  }, {
    eosio_name: 'peterpeter12',
    keys: generateAllKeys('579d5ba8a4423300b0c820930fdcc277bc805a29b94d026f35dec4b2e333820e'),
  }, {
    eosio_name: 'helga',
    keys: generateAllKeys('4040fbd7806ec09af7e1ceaf7ccac80e89eeeb1e85cee42f84c07b1d5a378110'),
  },{
    eosio_name: 'hans',
    keys: generateAllKeys('7695855d7b7590c52a0af76ded6866724dea37f07e33e4545c9ea17a2740e529'),
  }],
}


function signWithKey(privateKey, msg_hash_buf){
  const pk = Buffer.from(privateKey, "hex");
  const sig = ethUtil.ecsign(msg_hash_buf, pk);
  return ethUtil.toRpcSig(sig.v, sig.r, sig.s);
}

function toHexString(bytes){
  return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
}
function fromHexString(hexString){
  return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
}

function signWithTestSettings(logDataHex){
  const logDataBuffer = Buffer.from(logDataHex.substring(2), 'hex')
  const logDataKeccak = ethUtil.keccak(logDataBuffer)
  let signatures = []
  for(let i = 0; i < TestSettings.threshold; i++) {
    const sig = signWithKey(TestSettings.oracles[i].keys.ethPrivate, logDataKeccak)
    signatures.push(sig)
  }
  return signatures
}

contract('TeleportToken', (accounts) => {

  // List all oracles in console log
  for (let i = 0; i < TestSettings.oracles.length; i++) {
    const element = TestSettings.oracles[i]
    console.log(element.eosio_name, `${element.keys.ethAddress} ${element.keys.eosioPrivate}`)
  }

  let instance;
  before("get deploy contract", async function () {
    instance = await TeleportToken.deployed()
  })
  describe("Total supply", function () {
    it('should be the same as initially defined', async () => {
      const balance = await instance._totalSupply.call()
      assert.equal(balance.valueOf(), TestSettings.Token.totalSupply, `Total supply is not ${TestSettings.Token.totalSupply}`)
    })
  })
  let addChain1NetId, addChain2NetId
  let addChain1ShortNetId, addChain2ShortNetId
  let addChain2ContractName
  let addChain1Contract, addChain2Contract
  describe("Add chain", function () {
    before('Create chain parameters', async () => {
      addChain2ContractName = 'andreas'
      addChain1NetId = '0x' + TestSettings.EOSIO.netId;
      addChain1ShortNetId = addChain1NetId.substring(0, 10)
      addChain1Contract = getEosioAccountValue(TestSettings.EOSIO.contract_name)
      addChain2NetId= '0x' + 'aa0aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c414aa';
      addChain2ShortNetId = addChain2NetId.substring(0, 10)
      addChain2Contract = getEosioAccountValue(addChain2ContractName)
    })
    it('should fail without authorization', async () => {
      await catchRevert(instance.addChain(addChain1NetId, addChain1Contract, 0, 0, {from: accounts[3]}), 'Unauthorized chain registration')
    })
    it('should succeed to add a chain', async () => {
      await instance.addChain(addChain1NetId, addChain1Contract, 0, 0, {from: accounts[0]})
      let chain = await instance.chains(addChain1ShortNetId);
      assert.equal(chain.netId, addChain1NetId, 'Wrong net id of added chain')
      assert.equal(chain.contract_name, addChain1Contract, 'Wrong eosio contract name')
      assert.equal(chain.active, true, 'Added chain is not active')
    })
    it('should fail to add the same chain with different contract and different chain id', async () => {
      await catchRevert(instance.addChain(addChain1NetId, addChain2Contract, 1, 0, {from: accounts[0]}), 'Add the same chain net twice')
    })
    it('should fail to add another chain with the chain id of this contract', async () => {
      await catchRevert(instance.addChain(addChain2NetId, addChain2Contract, 2, 0, {from: accounts[0]}), 'Add a chain with the same id as this eth contract')
    })
    it('should fail to add another chain with same chain id', async () => {
      await catchRevert(instance.addChain(addChain2NetId, addChain2Contract, 0, 0, {from: accounts[0]}), 'Add the same chain id twice')
    })
    it('should succeed to add another chain', async () => {
      await instance.addChain(addChain2NetId, addChain2Contract, 1, 0,{from: accounts[0]})
      let chain = await instance.chains(addChain2ShortNetId);
      assert.equal(chain.netId, addChain2NetId, 'Wrong net id of added chain')
      assert.equal(chain.contract_name, addChain2Contract, 'Wrong eosio contract name')
      assert.equal(chain.active, true, 'Added chain is not active')
    })
  })
  describe("Remove chain", function () {
    it('should fail without authorization', async () => {
      await catchRevert(instance.rmChain(addChain2NetId, {from: accounts[3]}), 'Unauthorized removing chain')
    })
    it('should succeed to remove a chain', async () => {
      await instance.rmChain(addChain2NetId, {from: accounts[0]})
      let chain = await instance.chains(addChain2ShortNetId);
      assert.equal(chain.active, false, 'Removed chain is still active')
    })
  })
  describe("Register oracles", function () {
    it('should fail with unauthorized account', async () => {
      // Check test settings
      assert.equal(TestSettings.oracles.length > 0, true, 'No oracles defined')
      assert.equal(TestSettings.oracles.length > TestSettings.threshold, true, 'Need one more oracle for testing than threshold')

      // Check if someone else can register an oracle than owner
      await catchRevert(instance.regOracle(TestSettings.oracles[0].keys.ethAddress, {from: accounts[3]}), 'Unauthorized oracle registration')
    })
    it('should succeed to register several oracles', async () => {
      // Register all oracles
      for(let i = 0; i < TestSettings.oracles.length; i++){
        await instance.regOracle(TestSettings.oracles[i].keys.ethAddress, {from: accounts[0]});
        assert.equal(await instance.oracles(TestSettings.oracles[i].keys.ethAddress), true, 'Missing oracle' + i)
      }
    })
    let noOracle
    it('should succeed to remove an oracle', async () => {
      // Remove one oracle
      noOracle = TestSettings.oracles[TestSettings.oracles.length - 1].keys.ethAddress;
      await instance.unregOracle(noOracle, {from: accounts[0]});
      assert.equal(await instance.oracles(noOracle), false, 'Oracle is still registered')
    })
    it('should fail to reg an oracle with former oracle', async () => {
      await catchRevert(instance.regOracle(noOracle, {from: accounts[3]}), 'Unauthorized registration of former oracle')
    })
    it('should fail to reg an oracle twice', async () => {
      await catchRevert(instance.regOracle(TestSettings.oracles[0].keys.ethAddress, {from: accounts[0]}), 'Double registration of the same oracle')
    })
  })
  
  let tokenAmount1 = 500000
  const fullToken1 = Math.round(tokenAmount1/(10**TestSettings.Token.decimals))
  describe("Receive token from eosio chain", function () {
    let logAsset
    let logData, logData2, logDataTry
    let logDataHex, logDataHex2, logDataHexTry
    let signatures, signatures2, signaturesTry
    before('Calc claim data', async () => {
      // Create example log data
      logAsset = `${fullToken1}.${'0'.repeat(TestSettings.Token.decimals)} ${TestSettings.Token.symbol}`
      logData = {
        id: 0,                                                              // uint64
        timestamp: Math.round(new Date().getTime() / 1000),                 // uint32
        from: 'wololo',                                                     // string account name
        quantity: logAsset,                                                 // uint64
        chain_id: TestSettings.chainId,                                     // uint8
        eosio_contract: TestSettings.EOSIO.contract_name,                   // string account name
        eosio_id: TestSettings.EOSIO.netId,                                 // string
        eth_address: accounts[1].substring(2) + '000000000000000000000000', // address
      }
      logDataHex = serializeEosioTeleport(logData)
      signatures = signWithTestSettings(logDataHex)
      // Create example log data of invalid chain
      logAsset = `${fullToken1}.${'0'.repeat(TestSettings.Token.decimals)} ${TestSettings.Token.symbol}`
      logData2 = {
        id: 0,                                                              // uint64
        timestamp: Math.round(new Date().getTime() / 1000),                 // uint32
        from: 'wololo',                                                     // string account name
        quantity: logAsset,                                                 // uint64
        chain_id: TestSettings.chainId,                                     // uint8
        eosio_contract: addChain2ContractName,                                  // string account name
        eosio_id: addChain2NetId,                                           // string
        eth_address: accounts[1].substring(2) + '000000000000000000000000', // address
      }
      logDataHex2 = serializeEosioTeleport(logData2)
      signatures2 = signWithTestSettings(logDataHex2)
      // Create claim data with same id as before
      logDataTry = {
        id: 0,                                                              // uint64
        timestamp: Math.round(new Date().getTime() / 1000),                 // uint32
        from: 'wololo',                                                     // string account name
        quantity: logAsset,                                                 // uint64
        chain_id: TestSettings.chainId,                                     // uint8
        eosio_contract: TestSettings.EOSIO.contract_name,                   // string account name
        eosio_id: TestSettings.EOSIO.netId,                                 // string
        eth_address: accounts[7].substring(2) + '000000000000000000000000', // address
      }
      logDataHexTry = serializeEosioTeleport(logDataTry)
      signaturesTry = signWithTestSettings(logDataHexTry)
    })
    it('should have zero ballances at the beginning', async () => {
      assert.equal(await instance.balanceOf.call(accounts[0]).valueOf(), 0, 'Balance of account 0 is not 0')
      assert.equal(await instance.balanceOf.call(accounts[1]).valueOf(), 0, 'Balance of account 1 is not 0')
    })
    it('should fail to receive teleport with wrong signatures', async () => {   
      // Check wrong signatures
      let falseSignatures = [];
      for(let i = 0; i < TestSettings.threshold; i++) {
        const sig = signWithKey(TestSettings.oracles[i].keys.ethPrivate, ethUtil.keccak(Buffer(['1', '2', '3', '4'])))
        falseSignatures.push(sig);
      }
      await catchRevert(instance.claim.call(logDataHex, falseSignatures, {from: accounts[1]}), 'Claim with false signatures')
    });
    it('should fail to receive teleport with inactive chain', async () => {   
      await catchRevert(instance.claim.call(logDataHex2, signatures2, {from: accounts[2]}), 'Claim with inactive chain')
    });    
    it('should succeed to claim a teleport', async () => {
      await instance.claim(logDataHex, signatures, {from: accounts[2]});  // Claim by a different account is allowed
      assert.equal((await instance.balanceOf.call(accounts[2])).valueOf(), 0, 'Wrong account got funds')
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), fullToken1 * (10 ** TestSettings.Token.decimals), 'Account 1 does not got the right amount of funds')
    });
    it('should fail to claim the same teleport twice', async () => {
      await catchRevert(instance.claim(logDataHex, signatures, {from: accounts[2]}), 'It is possible claim the same teleport twice')
    });
    it('should fail to claim a teleport with already used id', async () => {
      await catchRevert(instance.claim(logDataHexTry, signaturesTry, {from: accounts[2]}), 'It is possible to claim a teleport with an already used id')
    });
    it('should fail to claim a teleport with an unknown chain id', async () => {
      logDataTry.id = 1
      logDataTry.chain_id = TestSettings.chainId + 1
      logDataHexTry = serializeEosioTeleport(logDataTry)
      signaturesTry = signWithTestSettings(logDataHexTry)
      await catchRevert(instance.claim(logDataHexTry, signaturesTry, {from: accounts[2]}), 'It is possible to claim a teleport with an unknown chain id')
    });
    it('should succeed to claim a second teleport with already used chain', async () => {
      logDataTry.chain_id = TestSettings.chainId
      logDataHexTry = serializeEosioTeleport(logDataTry)
      signaturesTry = signWithTestSettings(logDataHexTry)
      instance.claim(logDataHexTry, signaturesTry, {from: accounts[2]})
    });
  });
  describe("Send token within the chain", function () {
    let approveAmount
    let sendAmount
    it('should succeed to transfer tokens to yourself', async () => {
      await instance.transfer(accounts[1], tokenAmount1, {from: accounts[1]})
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), tokenAmount1, 'Token amount changed by sending to yourself')
    })
    it('should fail to transfer with impossible amounts', async () => {
      await catchRevert(instance.transfer(accounts[2], tokenAmount1 + 3, {from: accounts[1]}), 'It is possible to send more tokens than available for an account')
      assert.equal((await instance.balanceOf.call(accounts[2])).valueOf(), 0, 'It is possible to get more tokens from a sender than his balance is')
      await catchRevert(instance.transfer(accounts[1], tokenAmount1, {from: accounts[3]}), 'It is possible to send tokens without a balance')
    })
    it('should succeed to send tokens to another account', async () => {
      const balance1 = fullToken1 * (10 ** TestSettings.Token.decimals)
      const sendAmount = balance1 / 5
      await instance.transfer(accounts[2], sendAmount, {from: accounts[1]})
      tokenAmount1 = balance1 - sendAmount
      assert.equal((await instance.balanceOf.call(accounts[2])).valueOf(), sendAmount, 'Wrong account got funds')
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), tokenAmount1, 'Token amount of sender account is not reduced')
      approveAmount = tokenAmount1 / 5
    })
    it('should approve some tokens for another account', async () => {
      await instance.approve(accounts[3], approveAmount, {from: accounts[1]})
      assert.equal((await instance.balanceOf.call(accounts[3])).valueOf(), 0, 'Account should get rights not funds')
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), tokenAmount1, 'Account lost funds')
      sendAmount = approveAmount / 2
    })
    it('should succeed to send tokens by an approved account', async () => {
      await instance.transferFrom(accounts[1], accounts[4], sendAmount, {from: accounts[3]})
      tokenAmount1 -= sendAmount
      assert.equal((await instance.balanceOf.call(accounts[3])).valueOf(), 0, 'Account should not get funds by sending them to someone else')
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), tokenAmount1, 'Owner has wrong balance amount')
      assert.equal((await instance.balanceOf.call(accounts[4])).valueOf(), sendAmount, 'Receiver got not the right amount of funds')
    })
    it('should fail to send approved tokens with wrong parameters', async () => {
      await catchRevert(instance.transferFrom(accounts[1], accounts[5], 1, {from: accounts[2]}), 'It is possible to send tokens without the rights')
      await catchRevert(instance.transferFrom(accounts[1], accounts[5], sendAmount + 3, {from: accounts[3]}), 'It is possible to send more tokens than approved')
    })
    it('should succeed to remove approve rights', async () => {
      await instance.approve(accounts[3], 0, {from: accounts[1]})
      assert.equal((await instance.balanceOf.call(accounts[3])).valueOf(), 0, 'Account should not get funds by removing the approve')
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), tokenAmount1, 'Owner has wrong balance amount after removing approve')
      await catchRevert(instance.transferFrom(accounts[1], accounts[5], 1, {from: accounts[3]}), 'Can not remove the right to transfer tokens')
    })
  })
  let receiveChainId
  let secondReceiveChainId
  describe("Teleport to eosio chain", function () {
    let sendAmount
    let sendAmount2
    before("calc amounts for sending", async function () {
      sendAmount = tokenAmount1 / 2
      tokenAmount1 -= sendAmount
      receiveChainId = TestSettings.chainId + 1
      secondReceiveChainId = TestSettings.chainId + 2
    })
    it('should succeed a teleport', async () => {
      await instance.teleport('fraugertrud', sendAmount, receiveChainId, {from: accounts[1]});
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), tokenAmount1, 'Balance of account got not reduced')
      assert.equal(await instance.indexes(receiveChainId), 1, `Wrong index fort teleports to chain ${receiveChainId}`);
    })
    it('should fail teleport without any balance', async () => {
      await catchRevert(instance.teleport('fraugertrud', sendAmount, receiveChainId, {from: accounts[6]}), 'Can teleport without any balance')
      sendAmount2 = tokenAmount1 / 10;
      tokenAmount1 -= 3 * sendAmount2; 
    })
    it('should succeed further teleports with growing indexes', async () => {
      await instance.teleport('frauerdbeere', sendAmount2, secondReceiveChainId, {from: accounts[1]});
      await instance.teleport('frauerdbeere', sendAmount2, receiveChainId, {from: accounts[1]});
      await instance.teleport('frauerdbeere', sendAmount2, receiveChainId, {from: accounts[1]});
      assert.equal(await instance.indexes(secondReceiveChainId), 1, `Wrong index fort teleports to chain ${secondReceiveChainId }`);
      assert.equal(await instance.indexes(receiveChainId), 3, `Wrong index fort teleports to chain ${receiveChainId }`);
    })
  })
  describe("Check indexes by adding new chains", function () {
    let sendAmount
    let lastChainIndex, lastChain2Index
    before("calc amounts for sending", async function () {
      sendAmount = tokenAmount1 / 10
      lastChainIndex = 3
      lastChain2Index = 0
    })
    it('should succeed to remove the first chain', async () => {
      await instance.rmChain(addChain1NetId, {from: accounts[0]})
      assert.equal((await instance.chains(addChain1ShortNetId)).active, false, 'Removed first chain is still active')
    })
    it('should fail to add the first chain with first used zero index', async () => {
      await catchRevert(instance.addChain(addChain1NetId, addChain1Contract, receiveChainId, 0, {from: accounts[0]}), "Can add chain with already used first index")
    })
    it('should fail to add the first chain with used last index', async () => {
      await catchRevert(instance.addChain(addChain1NetId, addChain1Contract, receiveChainId, lastChainIndex - 1, {from: accounts[0]}), "Can add chain with already used last index")
    })
    it('should succeed to add the first chain with the destined next index', async () => {
      await instance.addChain(addChain1NetId, addChain1Contract, receiveChainId, lastChainIndex, {from: accounts[0]})
    })
    it('should succeed a teleport from the first chain', async () => {
      await instance.teleport('frauerdbeere', sendAmount, receiveChainId, {from: accounts[1]});
      lastChainIndex++
      assert.equal(await instance.indexes(receiveChainId), lastChainIndex, `Wrong index fort teleport to chain ${receiveChainId }`);
      tokenAmount1 -= sendAmount
    })
    it('should succeed to add a second chain with a much higher index', async () => {
      lastChain2Index = 10
      await instance.addChain(addChain2NetId, addChain2Contract, secondReceiveChainId, lastChain2Index, {from: accounts[0]})
    })
    it('should succeed a teleport from the second chain', async () => {
      await instance.teleport('frauerdbeere', sendAmount, secondReceiveChainId, {from: accounts[1]});
      lastChain2Index++
      assert.equal(await instance.indexes(secondReceiveChainId), lastChain2Index, `Wrong index fort teleport to chain ${secondReceiveChainId }`);
      tokenAmount1 -= sendAmount
    })
  })
  describe("Check freeze", function () {
    // Create new claim data with signatures
    const logDataTry = {
      id: 1,
      timestamp: Math.round(new Date().getTime() / 1000),
      from: 'wololo',               
      quantity: `${fullToken1}.${'0'.repeat(TestSettings.Token.decimals)} ${TestSettings.Token.symbol}`,
      chain_id: TestSettings.chainId,
      eth_address: accounts[1].substring(2) + '000000000000000000000000',      
      eosio_contract: TestSettings.EOSIO.contract_name,
      eosio_id: TestSettings.EOSIO.netId,
    }
    const logDataHex = serializeEosioTeleport(logDataTry)
    let signatures = signWithTestSettings(logDataHex)
    
    let sendAmount
    before("calc amount for sending", async function () {
      sendAmount = tokenAmount1 / 10 
    })
    it('should fail with unauthorized accound', async () => {
      await catchRevert(instance.freeze(true, false, false, {from: accounts[3]}), "Unauthorized execution of freeze function");
    })
    it('shoudl succeed to freeze claim function ', async () => {
      await instance.freeze(true, false, false, {from: accounts[0]});
      assert.equal(await instance.freezedClaim.call(), true, 'Claim is not freezed')
      assert.equal(await instance.freezedTeleport.call(), false, 'Teleport is freezed')
      assert.equal(await instance.freezedTransfer.call(), false, 'Transfer is freezed')
      await catchRevert(instance.claim(logDataHex, signatures, {from: accounts[2]}), 'Can claim even it is freezed')
    })  
    it('should succeed to freeze teleport function ', async () => {
      await instance.freeze(false, true, false, {from: accounts[0]});
      assert.equal(await instance.freezedClaim.call(), false, 'Claim is freezed')
      assert.equal(await instance.freezedTeleport.call(), true, 'Teleport is not freezed')
      assert.equal(await instance.freezedTransfer.call(), false, 'Transfer is freezed')
      await catchRevert(instance.teleport('frauerdbeere', sendAmount, TestSettings.chainId + 2, {from: accounts[1]}), 'Can teleport even it is freezed')
    })  
    it('should succeed to freeze transfer function ', async () => {
      await instance.freeze(false, false, true, {from: accounts[0]});
      assert.equal(await instance.freezedClaim.call(), false, 'Claim is freezed')
      assert.equal(await instance.freezedTeleport.call(), false, 'Teleport is freezed')
      assert.equal(await instance.freezedTransfer.call(), true, 'Transfer not freezed')
      await catchRevert(instance.transfer(accounts[1], sendAmount, {from: accounts[1]}), 'Can tranfer even it is freezed')
    })  
    it('shoudl succeed to unfreeze all', async () => {
      await instance.freeze(false, false, false, {from: accounts[0]});
    })
  })
  describe("Set minimum teleport amount", function () {
    let minAmount, receiveChainId, secondReceiveChainId
    before("calc amounts for sending", async function () {
      minAmount = 100
      tokenAmount1 -= minAmount
      receiveChainId = TestSettings.chainId + 1
      secondReceiveChainId = TestSettings.chainId + 2
    })
    it('should fail with unaothorized account', async () => {
      await catchRevert(instance.setMin(minAmount, {from: accounts[3]}), "Unauthorized set min")
    })
    it('should succeed to set min', async () => {
      await instance.setMin(minAmount, {from: accounts[0]})
      assert.equal((await instance.minteleport.call()).valueOf(), minAmount, 'Minimum teleport amount was not setted correctly')
    })
    it('should fail a teleport with lower amount than min amount', async () => {
      await catchRevert(instance.teleport('fraugertrud', 10, receiveChainId, {from: accounts[1]}), "Transaction with less amount than min amount");
    })
    it('should succeed a teleport with min amount', async () => {
      await instance.teleport('fraugertrud', minAmount, receiveChainId, {from: accounts[1]});
      assert.equal((await instance.balanceOf.call(accounts[1])).valueOf(), BigInt(tokenAmount1), 'Balance of account got not reduced')
    })
  })
  describe("Transfer ownership", function () {
    let owner;
    let newOwner;
    it('should succeed to check current ownership', async () => {
      owner = await instance.owner();
      newOwner = await instance.newOwner();
      assert.equal(owner, accounts[0], 'Old owner is not account 0')
      assert.equal(owner, accounts[0], 'NewOwner is at the beginning not account 0')
    })
    it('should fail with unaothorized account', async () => {
      await catchRevert(instance.transferOwnership.call(accounts[5], {from: accounts[3]}), "Unauthorized transferOwnership")
    })
    it('should succeed to set new ownership', async () => {
      await instance.transferOwnership(accounts[5], {from:accounts[0]});
      owner = await instance.owner();
      newOwner = await instance.newOwner();
      assert.equal(owner, accounts[0], 'TransferOwnership but owner should still be account 0')
      assert.equal(newOwner, accounts[5], 'TransferOwnership but new owner is not account 5')
    })
    it('should fail to accept ownership by unaothorized accounts', async () => {
      await catchRevert(instance.acceptOwnership.call({from: accounts[3]}), "Unauthorized acceptOwnership")
      await catchRevert(instance.acceptOwnership.call({from: accounts[0]}), "Unauthorized acceptOwnership by old owner")
    })
    it('should succeed to accept ownership', async () => {
      await instance.acceptOwnership.call({from: accounts[5]})
      owner = await instance.owner();
      newOwner = await instance.newOwner();
      assert.equal(owner, accounts[0], 'AcceptOwnership the new owner is not account 5')
      assert.equal(newOwner, accounts[5], 'AcceptOwnership the newOwner variable must be account 5, too')
    })
  })
});
