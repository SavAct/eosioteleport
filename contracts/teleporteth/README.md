# ETH Contract for Alien Teleport

## Deployment and initialization

1. Replace the values of `symbol`, `name`, `decimals` and `_totalSupply` in the constructor of the `TeleportToken.sol` file. `thisChainId` is an id to identify this eth contract. It should be different for each blockchain you deploy this contract
2. Compile and deploy the eth contract
3. Add your deployed teleporteos contract to this deployed eth contract by executing the function `addChain()`

```solidity
addChain(bytes32 netId, uint64 contract_name, uint8 chainId, uint64 telIndex)
```

- **_netId_** The id of the blockchain where you deployed your teleporteos contract
- **_contract_name_** Name of the deployed teleporteos contract
- **_chainId_** Id of your deployed teleport**eos** contract, which you defined with the `chainId` parameter by executing the `ini()` function. You can check it in the `stats` table by the `id` entry
- **_telIndex_** Teleport index to start with. This should start by zero on the first run. Each accepted teleport will increase this number

**Note:** You can use the interface of the [SavAct app](https://savact.app/#/_trx_/teleport/setup) to handle the deployed contracts.

## Testing the eth contract

### Installation

1. Install all dependencies

```
yarn install
```

### Test configuration

- If you want to stay on the current settings, you have to create a file named `.secret` in the same folder `teleporteth` and write a Mnemoni seed into it
- Otherwise use the file `truffle-config.js` to change your test net settings

### Run eth contract tests

1. Start two consoles
2. Use one console to run an eth test chain

```
ganache-cli
```

3. Use the other console to start the tests

```
truffle test
```
