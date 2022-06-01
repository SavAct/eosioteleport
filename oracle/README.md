# Oracles between EOSIO and ETH chains


## Installation
1. Install all dependencies
```
yarn install
```
## Configutration
Setup a file called `config.js` like the `config-example.js`

## Compile and start eos oracle
```
yarn eos
```
Start by a spezific teleport id with --id or -n

```
yarn eos -n {number}
```
## Compile and start eth oracle

```
yarn eth
```
Start by a spezific block number --block or -b

```
yarn eth -b {number}
```
## Config file
See the ***config-example.js*** for the structure of the config file.

***endpoints*** is an array of different endpoints which are evenly used. For a higher reliability the oracle switches automatically to another endpoint if one fails. ***epVerifications*** defines the number of different endpoints which has to verify the same request. This protects the Oracle from manipulated data of hijacked endpoints in the ***endpoints*** array as long as there are less hijacked endpoints than ***epVerifications***. Set it to 1 to disable multiple verification.
Setup the optional object ***telegram*** to receive Telegram messages on status changes and errors. 

On default ***config.js*** will be used. To specify another config file, use the command --config or -c 
```
yarn eos -c {path}
```

## Setup Telegram bot
1. Create a telegram bot with [@BotFather](https://core.telegram.org/bots). 
2. Wirte your API token in the config file and run id-provider
```
yarn id-provider
```
3. Get the id of your Telegram account by sending the bot a message
4. Close the id-provider
5. Store the id in the array of telegram.statusIds of the config file.
6. It is optional to store the id in the array of telegram.errorIds to get receive critical error messages as well.