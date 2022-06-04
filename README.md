# Eosio Teleport

Contracts and tools to create a bridge between EOSIO tokens and ERC-20 counterparts.

## Versions
The version numbers are necessary to make all teleports compatible with custom frontends.
This project is called version 2 and is a fork of [Kevin Tuncer](https://github.com/KevinTuncer/alienteleport), which is called version 1.
Itself is a backwards compatible fork of the origin [Alien Worlds](https://github.com/Alien-Worlds/alienteleport) teleport, which is seen as version 0. Each fork brings up a lot of new features and reduces the running costs.

### Features of version 2
- No continues EOSIO RAM consumption anymore, due to deletion of old entries without loss of consensus
- Minimum amount for ETH to EOSIO teleports
- Add and remove chains on ETH contracts
- Compile more information and use less space in ETH event logs
- Also secure when the same oracles serve more than one bridge
- Inform Telegram contacts about oracle status and errors

## Setup
See the `md-file` of each component for more informations.
1. Setup the [EOSIO contract](./contracts/teleporteos/README.md) and deploy it on the EOSIO chain of your choice, like EOS, WAX, ect.
2. Setup the [ETH contract](./contracts/teleporteth/README.md) and deploy it on all Ethereum based chains of your choice
3. Configure all [oracles](./oracles/README.md)
4. Initialize all deployed contracts, register the EOSIO chain on each Ethereum based chain and vice versa
5. Start the ETH and EOSIO oracles   

## Custom front end
Provide your own front end for your users or use the [SavAct App](https://savact.app/#/_trx_/teleport). Select your bridge by replacing the query values of bridge and eosio. The `bridge` value is the EOSIO contract account name of the teleport and the `eosio` value is the abbreviation or EOSIO chain id of the EOSIO chain
https://savact.app/#/_trx_/teleport?`bridge`=***other.worlds***&`eosio`=***WAX***