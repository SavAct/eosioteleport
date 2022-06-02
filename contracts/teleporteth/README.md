# ETH Contract for Alien Teleport

## Testing the eth contract

### Installation
1. Install all dependencies
```
yarn install
```

### Configutration
1. Replace the values of `symbol`, `name`, `decimals` and `_totalSupply` in the constructor of the `TeleportToken.sol` file 
2. Use truffle-config.js file to change your test net settings

### Run eth contract tests
1. Start two consoles
2. Use one to run an eth test chain
```
ganache-cli
```
3. Use the other to start the tests
```
truffle test
```