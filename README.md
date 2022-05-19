# Eosio Teleport

Contracts and tools to create a bridge between EOSIO tokens and ERC-20 counterparts.

## Note - Work in progress

The fork of [Kevin Tuncer](https://github.com/KevinTuncer/alienteleport) is called version 1 and backwards compatible to the origin [Alien Worlds](https://github.com/Alien-Worlds/alienteleport) teleport. There are a lot of new features, especially the option to clear completed EOSIO -> ETH teleports which reduces the steady EOSIO RAM consumption by 50 %. Breaking changes are needed to remove the steady EOSIO RAM consumption completely, without losing consensus. This and some other features are in progress on this fork, which will be called version 2.
The version numbers are necessary to make all teleports compatible with custom frontends.