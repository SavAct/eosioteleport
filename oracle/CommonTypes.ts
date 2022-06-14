export interface ConfigType {
    version: number,
    precision: number,
    symbol: string,
    confirmations: number,
    eos: {
        network: string,
        netId: string,
        id?: number,
        endpoint?: string,
        endpoints: Array<string>,
        teleportContract: string,
        oracleAccount: string,
        privateKey: string,
        oraclePermission?: string,
        epVerifications: number,
        waitCycle: number,
    },
    eth: {
        network: string,
        netId?: string,
        id?: bigint | number | string,
        endpoint?: string,
        endpoints: Array<string>,
        teleportContract: string,
        oracleAccount: string,
        privateKey: string,
        genesisBlock: number,
        epVerifications: number,
        waitCycle?: number,
        blocksToWait?: number,
    },
    telegram?: Telegram,
    powerup?: PowerUp,
}

export interface PowerUp{
    contract: string,
    paymenttoken: string,
    days: number,
    cpu_frac: number,
    net_frac: number,
    max_payment: string,
  
    min_cpu: number,
    min_net: number,
}

export interface Telegram{
    privateToken: string,
    statusIds?: Array<number>,
    errorIds?: Array<number>,
    costsIds?: Array<number>,
}

export interface TeleportTableEntry{
    id: number, 
    time: number, 
    account: string, 
    quantity: string, 
    chain_id: number, 
    eth_address: string, 
    oracles: Array<string>, 
    signatures: Array<string>, 
    claimed: boolean
}

// V1 == V2: ACTION sign(name oracle_name, uint64_t id, string signature);

// V1 == V2: ACTION claimed(name oracle_name, uint64_t id, checksum256 to_eth, asset quantity);
export interface eosio_claim_data {
    oracle_name: string;
    id: bigint;
    to_eth: string;
    quantity: string;
}

// v1: ACTION received(name oracle_name, name to, checksum256 ref, asset quantity, uint8_t chain_id, bool confirmed);
// v2: ACTION received(name oracle_name, name to, checksum256 ref, asset quantity, uint8_t chain_id, uint64_t index, bool confirmed);
export interface eosio_teleport_data {
    oracle_name: string;
    to: string;
    ref: string;
    quantity: string;
    chain_id: number;
    index?: bigint;
    confirmed: boolean;
}
