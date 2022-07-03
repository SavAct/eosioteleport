module.exports = {
    version: 2,
    precision: 4,       // Token precision
    symbol: 'TLM',      // Token symbol
    confirmations: 3,   // Number of needed oracle confirmations per teleport
    eos: {
        network: 'EOS', // Abbreviation of the chain
        id: 0,          // Id of this chain for this bridge
        netId: "e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473", // EOSIO identification for different chains
        endpoints: [
            'https://jungle.eosphere.io:443', 
            'http://jungle2.cryptolions.io:80', 
            'http://jungle2.cryptolions.io:8888',
        ],
        epVerifications: 2,                 // Verify data by this number of endpoints
        teleportContract: 'savactbridge',   // EOSIO token contract account
        oracleAccount: 'oracle1',           // EOSIO oracle account
        privateKey: '5K29JmEvWEnfdD5DV1bm9Ro4qMrTKhBGmTXuaaqmrZSMEntqqZQ', // Example private EOSIO key. Do not use it. It is public!
        waitCycle: 165,                     // Seconds to wait to check for new teleports after all teleports are handled. EOSIO chains typically needs 165 seconds to set transactions as irreversible.
    },
    eth: {
        network: 'BSC', // Abbreviation of the chain
        id: 2,          // Id of this chain for this bridge. Let it undefined to store the EOSIO recipient chain id on the recipient chain like the old way
        netId: '97',    // Id of this chain defined on chailist.org 
        endpoints: [
            'https://data-seed-prebsc-1-s1.binance.org:8545', 
            'https://data-seed-prebsc-2-s2.binance.org:8545', 
            'https://data-seed-prebsc-1-s2.binance.org:8545',
        ],
        genesisBlock: 19024616, // Initial block to start from
        epVerifications: 2,     // Verify data by this number of endpoints
        teleportContract: '0x281D131268f5D257297DDDe4B4047EeF881db79d', // ETH teleport contract address
        oracleAccount: '0x8353C7d4758D113Dd4407AC4b1115fF2E54D9eA0',    // ETH oracle address
        privateKey: '8940fbd7806ec09af7e1ceaf7ccac80e89eeeb1e85cee42f84c07b1d5a378100', // Example private ETH key. Do not use it. It is public!
        waitCycle: 10,          // Seconds to wait to check for new teleports after all teleports are handled
        blocksToWait: 6,        // Amount of blocks to wait until it will be considered as irreversible. Lowest accepted value is 5
    },
    telegram: {                 // Optional parameter to contact telegram accounts on oracle status and errors (It will only send messages, it will not receive any commands via Telegram)
        privateToken: '4814812745:YourSecretTelegramBotApiToken-927742',  // Your private telegram bot API token got by @BotFather
        statusIds: [00000000, 00000000],  // IDs of Telegram accounts which will receive a message on starting and ending the thread of the oracle program. You can use telegram-id-provider.js to request your id. 
        errorIds: [00000000],    // IDs of Telegram accounts which will receive error messages
        costsIds: [00000000],    // IDs of Telegram accounts which will receive a message on each action which costs system tokens
    },
    powerup:{                    // Optional parameter to borrow resources if needed
        contract: 'eosio',       // Contract which provides the powerup action
        paymenttoken: 'eosio.token', // System token contract
        days: 1,                 // Days the CPU and NET will be borrowed for on request. Currently only 1 day is possible on EOS mainnet.
        cpu: 2000,               // Lend micro seconds of CPU will borrowed per day and when needed
        net: 100000,             // Lend bytes of NET will borrowed per day and when needed
        // cpu_frac: 30000000,       // If this is setted, cpu parameter will be ignored. Fraction of total available CPU time = 10^15 / cpu_frac which will borrowed per day when needed
        // net_frac: 4000000,        // If this is setted, net parameter will be ignored. Fraction of total available NET time = 10^15 / cpu_frac which will borrowed per day when needed
        max_payment: '0.2000 EOS',   // Maximum amount which would be paid per day of a running instance (The right number of decimal places is important)

        min_cpu: 1200,           // Rent CPU if available CPU resource is below this number (Powerup may consume arroud 800 CPU)
        min_net: 500,              // Rent NET if available NET resource is below this number (Powerup may consume arroud 200 NET)
    }
}
