import {
  ContractDeployer,
  assertRowsEqual,
  AccountManager,
  Account,
  assertEOSErrorIncludesMessage,
  assertMissingAuthority,
  EOSManager,
  debugPromise,
  assertRowsEqualStrict,
  assertRowCount,
  assertEOSException,
  assertEOSError,
  UpdateAuth,
  assertRowsContain,
} from 'lamington'
import * as chai from 'chai'

import { Teleporteos, TeleporteosStatsItem } from './teleporteos'
import { EosioToken } from '../eosio.token/eosio.token'

const ethToken = '2222222222222222222222222222222222222222222222222222222222222222'

const token_contract = 'token.savact'
const token_symbol = 'SAVACT'

let teleporteos: Teleporteos
let alienworldsToken: EosioToken

let sender1: Account
let sender2: Account
let oracle1: Account
let oracle2: Account
let oracle3: Account
let oracle4: Account

describe('teleporteos', async () => {
  before(async () => {
    await seedAccounts()
  })
  // Initialize contract
  context('initialize contract (i/4)', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error i1', async () => {
        await assertMissingAuthority(
          teleporteos.ini(`100.0000 ${token_symbol}`, `0.0000 ${token_symbol}`, '0', false, 3, 0, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed i2', async () => {
        await teleporteos.ini(`100.0000 ${token_symbol}`, `0.0000 ${token_symbol}`, '0', false, 3, 0, { from: teleporteos.account })
      })

      it('execute again should fail i3', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.ini(`50.0000 ${token_symbol}`, `0.0000 ${token_symbol}`, '0', false, 3, 0, { from: teleporteos.account }),
          'Already initialized'
        )
      })
      it('should update stats table i4', async () => {
        let { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.tokencontr).equal(token_contract, 'Wrong token contract')
        chai.expect(item.collected).equal(0, 'Wrong collected')
        chai.expect(item.fin).equal(false, 'Wrong freeze in')
        chai.expect(item.fout).equal(false, 'Wrong freeze out')
        chai.expect(item.fcancel).equal(false, 'Wrong freeze cancel')
        chai.expect(item.foracles).equal(false, 'Wrong freeze oracles')
        chai.expect(item.oracles).equal(0, 'Wrong oracle amount')
        chai.expect(item.min).equal(1000000, 'Wrong minimum transfer amount')
        chai.expect(item.fixfee).equal(0, 'Wrong fix fee')
        chai.expect(item.varfee).equal('0.00000000000000000', 'Wrong variable fee')
        chai.expect(item.version).above(0, 'Wrong version')
        chai.expect(item.chains.length).equal(0, 'Wrong amount of added chains')
      })
    })
  })
  // Add chains
  context('add chain (ac/6)', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error ac1', async () => {
        await assertMissingAuthority(
          teleporteos.addchain('Ethereum', 'ETH', 1, '1', '0x497329439abdc323u497329439abdc323u', '0x497329439abdc323u497329439abdc323u', 0, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      const ethName = 'Ethereum'
      const ethShortName = 'ETH'
      const ethId = 1
      const ethNetId = '1'
      const ethContract = '0x497329439abdc323u497329439abdc323u'
      const ethTokenContract = '0x557329439abdc323u497329439abdc3266'

      it('should succeed ac2', async () => {
        await teleporteos.addchain(ethName, ethShortName, ethId, ethNetId, ethContract, ethTokenContract, 0, { from: teleporteos.account })
      })
      it('should update stats table ac3', async () => {
        const { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.chains.length).equal(1, 'Wrong amount of added chains')
        const chain = item.chains[0] as unknown as {key: number, value: {name: string, net_id: string, teleaddr: string, tokenaddr: string}}
        chai.expect(chain.key).equal(ethId, 'Wrong chain id' + ' got: ' + String(item.chains[0]))
        chai.expect(chain.value.name).equal(ethName, 'Wrong chain name')
        chai.expect(chain.value.net_id).equal(ethNetId, 'Wrong chain name')
        chai.expect(chain.value.teleaddr).equal(ethContract, 'Wrong chain id')
        chai.expect(chain.value.tokenaddr).equal(ethTokenContract, 'Wrong chain id')
      })
      it('should fail with already existing id ac4', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.addchain(ethName, ethShortName, ethId, ethNetId, ethContract, ethTokenContract, 0, { from: teleporteos.account }), 
          'This chain is already listed'
        )
      })
      it('should succeed to add another three chains ac5', async () => {
        await teleporteos.addchain('Binance Smart Chain', 'BSC', 2, '2', ethContract, ethTokenContract, 0, { from: teleporteos.account })
        await teleporteos.addchain('WAX', 'WAX', 6, '6', 'bridge.chain', 'my.token', 0, { from: teleporteos.account })
        await teleporteos.addchain('Bitcoin', 'BTC', 3, '3', ethContract, ethTokenContract, 0, { from: teleporteos.account })
        await teleporteos.addchain('TRON', 'TRON', 4, '4', ethContract, ethTokenContract, 0, { from: teleporteos.account })
        await teleporteos.addchain('XMR', 'XMR', 5, '5', ethContract, ethTokenContract, 0, { from: teleporteos.account })
      })
      it('should update stats table ac6', async () => {
        const { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.chains.length).equal(6, 'Wrong amount of added chains')
      })
    })
  })
  // Remove chain
  context('remove chain (rc/3)', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error rc1', async () => {
        await assertMissingAuthority(
          teleporteos.rmchain(6, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed rc2', async () => {
        await teleporteos.rmchain(6, { from: teleporteos.account })
      })
      it('should update stats table rc3', async () => {
        const { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.chains.length).equal(5, 'Wrong amount of remaining chains')
      })
    })
  })
  // Recoracle
  context('regoracle (ro/6)', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error ro1', async () => {
        await assertMissingAuthority(
          teleporteos.regoracle(oracle1.name, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed for oracle1 ro2', async () => {
        await teleporteos.regoracle(oracle1.name, {
          from: teleporteos.account,
        })
      })
      it('should succeed to add another oracle ro3', async () => {
        await teleporteos.regoracle(oracle2.name, {
          from: teleporteos.account,
        })
      })
      it('should succeed to add another oracle ro4', async () => {
        await teleporteos.regoracle(oracle3.name, {
          from: teleporteos.account,
        })
      })
      it('should succeed to add another oracle ro5', async () => {
        await teleporteos.regoracle(oracle4.name, {
          from: teleporteos.account,
        })
      })
      it('should update oracles table ro6', async () => {
        await assertRowsEqual(teleporteos.oraclesTable(), [
          { account: oracle1.name },
          { account: oracle2.name },
          { account: oracle3.name },
          { account: oracle4.name },
        ])
      })
    })
  })

  // Unrecoracle
  context('unregoracle (uo/3)', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error uo1', async () => {
        await assertMissingAuthority(
          teleporteos.unregoracle(oracle4.name, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed uo2', async () => {
        await teleporteos.unregoracle(oracle4.name, {
          from: teleporteos.account,
        })
      })
      it('should update oracles table uo3', async () => {
        await assertRowsEqual(teleporteos.oraclesTable(), [
          { account: oracle1.name },
          { account: oracle2.name },
          { account: oracle3.name },
        ])
      })
    })
  })

  // Receive teleport
  context('received from BSC/ETH (rt/16)', async () => {
    context('with unregistered oracle', async () => {
      it('should fail rt1', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            sender1.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            1,
            true,
            {
              from: sender1,
            }
          ),
          'Account is not an oracle'
        )
      })
    })
    context('with registered oracle', async () => {
      context('with wrong auth', async () => {
        it('should fail with auth error rt2', async () => {
          await assertMissingAuthority(
            teleporteos.received(
              oracle3.name,
              sender1.name,
              '1111111111111111111111111111111111111111111111111111111111111111',
              `123.0000 ${token_symbol}`,
              2,
              1,
              true,
              { from: sender1 }
            )
          )
        })
      })
      context('with correct auth', async () => {
        it('should succeed rt3', async () => {
          await teleporteos.received(
            oracle3.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            1,
            true,
            { from: oracle3 }
          )
        })
        it('should insert into receipt table rt4', async () => {
          await assertRowsEqual(teleporteos.receiptsTable(), [
            {
              approvers: [oracle3.name],
              chain_id: 2,
              completed: false,
              confirmations: 1,
              date: new Date(),
              id: 0,
              index: 1,
              quantity: `123.0000 ${token_symbol}`,
              ref: '1111111111111111111111111111111111111111111111111111111111111111',
              to: sender1.name,
            },
          ])
        })
      })
    })
    context('with another registered oracle rt5', async () => {
      it('should add another receipt to existing', async () => {
        await teleporteos.received(
          oracle1.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          1,
          true,
          { from: oracle1 }
        )
      })
    })
    context('with other quantity', async () => {
      it('should create new entry rt6', async () => {
        await teleporteos.received(
          oracle3.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `0.1230 ${token_symbol}`,
          1,
          1,
          true,
          { from: oracle3 }
        )
      })
    })
    context('with other account', async () => {
      it('should create new entry rt7', async () => {
        await teleporteos.received(
          oracle3.name,
          sender2.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          1,
          true,
          { from: oracle3 }
        )
      })
    })
    context('with already signed oracle', async () => {
      it('should fail with already approved error rt8', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle3.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            1,
            true,
            { from: oracle3 }
          ),
          'Oracle has already approved'
        )
      })
    })
    context('with other previous index', async () => {
      it('should create new entry rt9', async () => {
        await teleporteos.received(
          oracle1.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          0,
          true,
          { from: oracle1 }
        )
      })
    })
    context('with same previous index other oracle', async () => {
      it('should succeed rt10', async () => {
        await teleporteos.received(
          oracle3.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          0,
          true,
          { from: oracle3 }
        )
      })
    })
    context('with 3 full approvals', async () => {
      it('should fail without confirming previous first rt11', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle2.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            1,
            true,
            {
              from: oracle2,
            }
          ),
          "Has to confirm previous teleports first"
        )
      })
      it('should succeed rt12', async () => {
        await teleporteos.received(
          oracle2.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          0,
          true,
          {
            from: oracle2,
          }
        )
      })
      it('should transfer tokens rt13', async () => {
        await assertRowsEqual(
          alienworldsToken.accountsTable({ scope: sender1.name }),
          [
            {
              balance: `1000123.0000 ${token_symbol}`,
            },
          ]
        )
      })
      it('should fail to confirm a teleport twice rt14', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle2.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            0,
            true,
            {
              from: oracle2,
            }
          ),
          "This teleport is already completed"
        )
      })
      it('should fail when teleport with same index and chain is already confirmed rt15', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle2.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `1.0000 ${token_symbol}`,
            2,
            0,
            true,
            {
              from: oracle2,
            }
          ),
          "This teleport is already completed"
        )
      })
      it('should update receipt table rt16', async () => {
        await assertRowsEqual(teleporteos.receiptsTable(), [
          {
            id: 0,
            approvers: [oracle1.name, oracle3.name],
            date: new Date(),
            chain_id: 2,
            index: 1,
            confirmations: 2,
            quantity: `123.0000 ${token_symbol}`,
            ref: '1111111111111111111111111111111111111111111111111111111111111111',
            to: sender1.name,
            completed: false,
          },
          {
            id: 1,
            approvers: [oracle3.name],
            date: new Date(),
            chain_id: 1,
            index: 1,
            confirmations: 1,
            quantity: `0.1230 ${token_symbol}`,
            ref: '1111111111111111111111111111111111111111111111111111111111111111',
            to: sender1.name,
            completed: false,
          },
          {
            id: 2,
            approvers: [oracle3.name],
            date: new Date(),
            chain_id: 2,
            index: 1,
            confirmations: 1,
            quantity: `123.0000 ${token_symbol}`,
            ref: '1111111111111111111111111111111111111111111111111111111111111111',
            to: sender2.name,
            completed: false,
          },
          {
            id: 3,
            approvers: [oracle1.name, oracle2.name, oracle3.name],
            date: new Date(),
            chain_id: 2,
            index: 0,
            confirmations: 3,
            quantity: `123.0000 ${token_symbol}`,
            ref: '1111111111111111111111111111111111111111111111111111111111111111',
            to: sender1.name,
            completed: true,
          },
        ])
      })
    })
  })

  // Teleport
  context('teleport (t/7)', async () => {
    context('without valid auth', async () => {
      it('should fail with auth error t1', async () => {
        await assertMissingAuthority(
          teleporteos.teleport(sender1.name, `123.0000 ${token_symbol}`, 2, ethToken, {
            from: sender2,
          })
        )
      })
    })
    context('with valid auth', async () => {
      context('with invalid quantity', async () => {
        it('should fail with valid error t2', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, '123.0000', 2, ethToken, {
              from: sender1,
            }),
            'Amount is not valid'
          )
        })
      })
      context('with amount below minimum', async () => {
        it('should fail with below min error error t3', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, `23.0000 ${token_symbol}`, 2, ethToken, {
              from: sender1,
            }),
            'Transfer is below minimum token amount'
          )
        })
      })
      context('with no available deposit', async () => {
        it('should fail with no deposit error t4', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, `123.0000 ${token_symbol}`, 2, ethToken, {
              from: sender1,
            }),
            'Deposit not found'
          )
        })
      })
      context('with not enough deposit', async () => {
        before(async () => {
          await alienworldsToken.transfer(
            sender1.name,
            teleporteos.account.name,
            `120.0000 ${token_symbol}`,
            'teleport test',
            { from: sender1 }
          )
        })
        it('should fail with not enough deposit error t5', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, `123.0000 ${token_symbol}`, 2, ethToken, {
              from: sender1,
            }),
            'Not enough deposited'
          )
        })
      })
      context('with enough deposit', async () => {
        before(async () => {
          await alienworldsToken.transfer(
            sender1.name,
            teleporteos.account.name,
            `104.0000 ${token_symbol}`,
            'teleport test extra amount',
            { from: sender1 }
          )
        })
        it('should succeed t6', async () => {
          await teleporteos.teleport(
            sender1.name,
            `123.0000 ${token_symbol}`,
            2,
            ethToken,
            { from: sender1 }
          )
        })
        it('should update teleports table t7', async () => {
          let { rows: [item] } = await teleporteos.teleportsTable()
          chai.expect(item.account).equal(sender1.name)
          chai.expect(item.chain_id).equal(2)
          chai.expect(item.id).equal(0)
          chai.expect(item.quantity).equal(`123.0000 ${token_symbol}`)
          chai.expect(item.eth_address).equal(ethToken)
          chai.expect(item.oracles).empty
          chai.expect(item.signatures).empty
          chai.expect(item.claimed).false
        })
      })
    })
  })

  // Sign
  context('sign teleport (s/5)', async () => {
    context('with incorrect auth', async () => {
      it('should fail s1', async () => {
        await assertMissingAuthority(
          teleporteos.sign(oracle1.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: sender1 })
        )
        await assertMissingAuthority(
          teleporteos.sign(oracle1.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle2 })
        )
      })
    })
    context('with correct auth', async () => {
      it('wrong parameters s2', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.sign(oracle1.name, 10, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle1 }),
          'Teleport not found'
        )
      })
      it('should succeed s3', async () => {
        await teleporteos.sign(oracle1.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle1 })
        const { rows: [item] } = await teleporteos.teleportsTable({lowerBound: '0'})
        chai.expect(item.id).equal(0, 'Wrong id')
        chai.expect(item.oracles.length).equal(1, 'Wrong sign amount of oracles')
        chai.expect(item.oracles[0]).equal(oracle1.name, 'Wrong oracle')
      })
      it('refuse double signing s4', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.sign(oracle1.name, 0, 'abc', { from: oracle1 }),
          'Oracle has already signed'
        )
      })
      it('refuse same signature s5', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.sign(oracle2.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle2 }),
          'Already signed with this signature'
        )
      })
    })
  })
  
  // Teleport claimed
  context('set teleport claimed (cl/4)', async () => {
    context('with incorrect auth', async () => {
      it('should fail cl1', async () => {
        await assertMissingAuthority(
          teleporteos.claimed(oracle1.name, 0, ethToken, `123.0000 ${token_symbol}`, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      context('wrong parameters', async () => {
        it('should fail cl2', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.claimed(oracle1.name, 10, ethToken, `123.0000 ${token_symbol}`, { from: oracle1 }),
            'Teleport not found'
          )
          await assertEOSErrorIncludesMessage(
            teleporteos.claimed(oracle1.name, 0, ethToken, `1.0000 ${token_symbol}`, { from: oracle1 }),
            'Quantity mismatch'
          )
        })
      })
      context('correct parameters', async () => {
        it('should succeed cl3', async () => {
          await teleporteos.claimed(oracle1.name, 0, ethToken, `123.0000 ${token_symbol}`, { from: oracle1 })
          const { rows: [item] } = await teleporteos.teleportsTable({lowerBound: '0'})
          chai.expect(item.id).equal(0, 'Wrong id')
          chai.expect(item.claimed).equal(true)
        })
        it('should refuse double claiming cl4', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.claimed(oracle1.name, 0, ethToken, `123.0000 ${token_symbol}`, { from: oracle1 }),
            'Already marked as claimed'
          )
        })
      })
    })
  })

  // Adjust minimum amount
  context('adjust minimum amount (m/5)', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error m1', async () => {
        await assertMissingAuthority(
          teleporteos.setmin(`200.0000 ${token_symbol}`, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('wrong symbol name should fail m2', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.setmin(`200.0000 ${token_symbol.length <= 3? token_symbol + 'A': 'AAA'}`, { from: teleporteos.account }),
          'Wrong token'
        )
      })
      it('wrong symbol precision should fail m3', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.setmin(`200 ${token_symbol}`, { from: teleporteos.account }),
          'Wrong token'
        )
      })
      it('should succeed m4', async () => {
        await teleporteos.setmin(`200.0000 ${token_symbol}`, { from: teleporteos.account })
      })
      it('should update threshold m5', async () => {
        let { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.min).equal(2000000)
      })
    })
  })

  // Adjust fee
  const fixfee = BigInt(1102)
  context('adjust fee (f/13)', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error f1', async () => {
        await assertMissingAuthority(
          teleporteos.setfee(amountToAsset(fixfee, token_symbol, 4), '0.007', { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      context('with wrong variable fee', async () => {
        it('should fail f2', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`0.0000 ${token_symbol}`, '-0.01', { from: teleporteos.account }),
            'Variable fee has to be between 0 and 0.20'
          )
        })
        it('should fail f3', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`0.0000 ${token_symbol}`, '1', { from: teleporteos.account }),
            'Variable fee has to be between 0 and 0.20'
          )
        })     
      })
      context('with wrong fix fee', async () => {
        it('wrong symbol name should fail f4', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`0.0001 ${token_symbol.length <= 3? token_symbol + 'A': 'AAA'}`, '0', { from: teleporteos.account }),
            'Wrong token'
          )
        })
        it('wrong symbol precision should fail f5', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`1 ${token_symbol}`, '0.007', { from: teleporteos.account }),
            'Wrong token'
          )
        })
        it('too high amount should fail f6', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`200.0000 ${token_symbol}`, '0.007', { from: teleporteos.account }),
            'Fees are too high relative to the minimum amount of token transfers'
          )
        })  
      })
      context('with valid fees', async () => {
        it('should succeed f7', async () => {
          await teleporteos.setfee(amountToAsset(fixfee, token_symbol, 4), '0.007', { from: teleporteos.account })
        })
        it('should update stats table f8', async () => {
          let { rows: [item] } = await teleporteos.statsTable()
          chai.expect(BigInt(item.fixfee)).equal(fixfee, 'Wrong fix fee')
          chai.expect(item.varfee).equal('0.00700000000000000', 'Wrong variable fee')
        })
        it('should succeed withdraw and deposit f9', async () => {
          await teleporteos.withdraw(sender1.name, `1.0000 ${token_symbol}`, { from: sender1 })
          {
            let { rows } = await teleporteos.depositsTable()
            for(let item of rows){
              if(item.account == sender1.name){
                chai.expect(item.quantity).equal(`100.0000 ${token_symbol}`, 'Wrong deposit on withdraw')
                break
              }
            }
          }
          let { rows: [item_balance] } = await alienworldsToken.accountsTable({scope: sender1.name})
          chai.expect(item_balance.balance).equal(`999900.0000 ${token_symbol}`, 'Wrong balance after withdraw')
          await alienworldsToken.transfer(
            sender1.name,
            teleporteos.account.name,
            `200.0000 ${token_symbol}`,
            'teleport test',
            { from: sender1 }
          )
          let deposits = await teleporteos.depositsTable()
          for(let item of deposits.rows){
            if(item.account == sender1.name){
              chai.expect(item.quantity).equal(`300.0000 ${token_symbol}`, 'Wrong balance on deposit')
              break
            }
          }
        })
        it('should succeed teleport f10', async () => {
          await teleporteos.teleport(sender1.name, `200.0000 ${token_symbol}`, 2, ethToken, { from: sender1 })
        })
        it('should have listed last teleport in table f11', async () => {
          let deposits = await teleporteos.depositsTable()
          for(let item of deposits.rows){
            if(item.account == sender1.name){
              chai.expect(item.quantity).equal(`100.0000 ${token_symbol}`, 'Wrong balance on deposit')
              break
            }
          }
          // Check collected amount
          const value = BigInt(2000000)
          const fee = calcFee(value, BigInt(fixfee), 0.007)
          let { rows: [stat] } = await teleporteos.statsTable()
          chai.expect(stat.collected.toString()).equal(fee.toString(), "Wrong collected fee amount")
          // check teleport amount 
          let teleports = await teleporteos.teleportsTable({reverse: true})
          chai.expect(teleports.rows[0].quantity).equal(amountToAsset(value - fee, token_symbol, 4), "Wrong fee calculation")
        })
        context('valid received until confirmation', async () => {
          let sender1Balance: bigint;
          let sender1DepositBalance: bigint;
          let oldStat: TeleporteosStatsItem
          const hash = '1111111111111111111111111111111111111111111111111111111111111113'
          const sendAmount = BigInt(1230)
          const sendAsset = amountToAsset(sendAmount, token_symbol, 4)
          before(async () => {
            // Get current balance of sender 1 on token contract
            let { rows: [a_item_old] } = await alienworldsToken.accountsTable({scope: sender1.name})
            sender1Balance = stringToAsset(a_item_old.balance).amount
            // Get current balance of sender 1 on deposits
            sender1DepositBalance = BigInt(0)
            let deposits_old = await teleporteos.depositsTable()
            for(let item of deposits_old.rows){
              if(item.account == sender1.name){
                sender1DepositBalance = stringToAsset(item.quantity).amount
                break
              }
            }
            // Get current stat
            let stats = await teleporteos.statsTable()
            oldStat = stats.rows[0] 
          })
          it('should succeed f12', async () => {
            // Send received action by three oracles, so it should be completed
            await teleporteos.received(
              oracle1.name, sender1.name, hash, sendAsset, 2, 1, true, { from: oracle1 }
            )
            await teleporteos.received(
              oracle2.name, sender1.name, hash, sendAsset, 2, 1, true, { from: oracle2 }
            )
            await teleporteos.received(
              oracle3.name, sender1.name, hash, sendAsset, 2, 1, true, { from: oracle3 }
            )
          })
          it('should have expected table entries f13', async () => {
            let { rows: [confirmedItem] } = await teleporteos.receiptsTable({
              keyType: 'sha256', 
              indexPosition: 2, 
              lowerBound: hash
            })
            chai.expect(confirmedItem.confirmations).equal(3, "Wrong amount of confirmations")
            chai.expect(confirmedItem.completed).equal(true, "Not completed") 
            // Check collected
            const fee = calcFee(sendAmount, fixfee, 0.007)
            let { rows: [stat_new] } = await teleporteos.statsTable()
            chai.expect(stat_new.collected.toString()).equal((BigInt(oldStat.collected) + fee).toString(), "Collected got wrong amount of fees")
            // Check new balance on token contract
            let { rows: [a_item_new] } = await alienworldsToken.accountsTable({scope: sender1.name})
            chai.expect(stringToAsset(a_item_new.balance).amount.toString()).equal((sender1Balance + sendAmount - fee).toString(), "New Balance reduced by a fee is wrong")
            // Check if deposit table is unchanged
            let deposits_new = await teleporteos.depositsTable()
            for(let item of deposits_new.rows){
              if(item.account == sender1.name){
                chai.expect(stringToAsset(item.quantity).amount.toString()).equal(sender1DepositBalance.toString(), "Deposit has changed")
                break
              }
            }
          })
        })
      })
    })
  })

  // Adjust threshold
  context('adjust threshold (th/5)', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error th1', async () => {
        await assertMissingAuthority(
          teleporteos.setthreshold(2, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('and incorrect amount should fail th2', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.setthreshold(0, { from: teleporteos.account }),
          'Needed confirmation amount has to be grater than 0'
        )
      })
      const hash = '1111111111111111111111111111111111111111111111111111111111111114'
      const sendAmount = BigInt(10000)
      const sendAsset = amountToAsset(sendAmount, token_symbol, 4)
      it('should succeed th3', async () => {
        // Set threshold to 2
        await teleporteos.setthreshold(2, { from: teleporteos.account })
        // Check stats
        let { rows: [stat] } = await teleporteos.statsTable()
        chai.expect(stat.threshold).equal(2, "Threshold was not inherited")
      })
      // Send received action by three oracles, so it should be completed
      it('should succeed first receipt th4', async () => {
        // Execute recepits by one oracles
        await teleporteos.received(
          oracle1.name, sender1.name, hash, sendAsset, 1, 0, true, { from: oracle1 }
        )
        let { rows: [unconfItem] } = await teleporteos.receiptsTable({
          keyType: 'sha256', 
          indexPosition: 2,
          lowerBound: hash
        })
        chai.expect(unconfItem.confirmations).equal(1, "Wrong amount of confirmations")
        chai.expect(unconfItem.completed).equal(false, "Is completed")
      })
      it('should succeed second receipt and be completed th5', async () => {
        // Execute recepits by a second oracles
        await teleporteos.received(
          oracle2.name, sender1.name, hash, sendAsset, 1, 0, true, { from: oracle2 }
        )
        let { rows: [confItem] } = await teleporteos.receiptsTable({
          keyType: 'sha256', 
          indexPosition: 2, 
          lowerBound: hash
        })
        chai.expect(confItem.confirmations).equal(2, "Wrong amount of confirmations")
        chai.expect(confItem.completed).equal(true, "Is not completed")
        
        // Execute recepits by a third oracles
        await assertEOSErrorIncludesMessage(
          teleporteos.received(oracle3.name, sender1.name, hash, sendAsset, 2, 0, true, { from: oracle3 }), 
          'This teleport is already completed'
        )
      })
    })
  })

  // Delete teleports
  context('delete teleports (dt/6)', async () => {
    it('with incorrect auth should fail with auth error dt1', async () => {
      await assertMissingAuthority(
        teleporteos.delteles('0', { from: sender1 })
      )
      await assertMissingAuthority(
        teleporteos.delteles('0', { from: oracle1 })
      )
    })
    it('with not available id should fail dt2', async () => {
      await assertEOSErrorIncludesMessage(
        teleporteos.delteles('100', { from: teleporteos.account }), 
        'Teleport id not found'
      )
    })
    it('preparation dt3', async () => {
      // Add three teleports
      await teleporteos.teleport(alienworldsToken.account.name, `203.0000 ${token_symbol}`, 1, ethToken, { from: alienworldsToken.account })
      await teleporteos.teleport(alienworldsToken.account.name, `203.0000 ${token_symbol}`, 2, ethToken, { from: alienworldsToken.account })
      await teleporteos.teleport(alienworldsToken.account.name, `203.0000 ${token_symbol}`, 3, ethToken, { from: alienworldsToken.account })
      const fee = calcFee(BigInt(2030000), BigInt(fixfee), 0.007)
      const sendAsset = amountToAsset(BigInt(2030000) - fee, token_symbol, 4)
      // Claim all teleports but not the second in table 
      await teleporteos.claimed(oracle1.name, 2, ethToken, sendAsset, { from: oracle1 })
      await teleporteos.claimed(oracle1.name, 3, ethToken, sendAsset, { from: oracle1 })
      await teleporteos.claimed(oracle1.name, 4, ethToken, sendAsset, { from: oracle1 })
    })
    context('with correct auth', async () => {
      context('delete to id 2', async () => {
        it('should succeed dt4', async () => {
            // Delete until the third one
            await teleporteos.delteles('2', { from: teleporteos.account })
            const teleports = await teleporteos.teleportsTable()
            chai.expect(teleports.rows.length).equal(4, 'Wrong amount of teleports are deleted')
            chai.expect(teleports.rows[0].id).equal(1, 'Wrong deletion')
            chai.expect(teleports.rows[1].id).equal(2, 'Wrong deletion')
            chai.expect(teleports.rows[2].id).equal(3, 'Wrong deletion')
            chai.expect(teleports.rows[3].id).equal(4, 'Wrong deletion')
        })
      })
      context('delete to last id', async () => {
        it('should fail dt5', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.delteles('5', { from: teleporteos.account }), 
            'Teleport id not found'
          )
        })
        it('should succeed dt6', async () => {
          // Delete until the third one
          await teleporteos.delteles('4', { from: teleporteos.account })
          const teleports = await teleporteos.teleportsTable()
          chai.expect(teleports.rows.length).equal(2, 'Wrong amount of teleports are deleted')
          chai.expect(teleports.rows[0].id).equal(1, 'Wrong deletion')
          chai.expect(teleports.rows[1].id).equal(4, 'Wrong deletion')
        })
      })
    })
  })

  // Cancel action
  context('cancel teleport (c/3)', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error c1', async () => {
        await assertMissingAuthority(
          teleporteos.cancel('1', { from: oracle1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should fail when it is claimed c2', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.cancel('4', { from: alienworldsToken.account }),
          'Teleport is already claimed'
        )
      })
      it('should fail when it is too early c3', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.cancel('1', { from: sender1 }),
          'Teleport has not expired'
        )
      })
    })
  })

  // Pay oracles
  context('pay oracles (po/1)', async () => {
    it('should succeed po1', async () => {
      const {rows: [initialStat]} = await teleporteos.statsTable()
      const amountPerOracle = BigInt(Math.floor(Number(initialStat.collected) / initialStat.oracles))
      const rest = BigInt(initialStat.collected) - (amountPerOracle * BigInt(initialStat.oracles))
      await teleporteos.payoracles({ from: sender1 })
      // Check rest
      const {rows: [stat]} = await teleporteos.statsTable()
      chai.expect(BigInt(stat.collected)).equal(rest, 'Wrong collected rest')
      // Check oracle deposit amounts
      const deposits = await teleporteos.depositsTable({lowerBound: oracle1.name})
      chai.expect(stringToAsset(deposits.rows[0].quantity).amount).equal(amountPerOracle, 'Wrong amount for oracle')
      chai.expect(stringToAsset(deposits.rows[1].quantity).amount).equal(amountPerOracle, 'Wrong amount for oracle')
      chai.expect(stringToAsset(deposits.rows[2].quantity).amount).equal(amountPerOracle, 'Wrong amount for oracle')
    })
  })

  // Delete receipts
  context('delete receipts (dr/9)', async () => {
    let initialReceipts;
    let lastId: number;
    it('get initial receipt table dr1', async () => {
      initialReceipts = await teleporteos.receiptsTable()
      lastId = Number(initialReceipts.rows[initialReceipts.rows.length - 1].id)
    })
    it('with user auth should fail with auth error dr2', async () => {
      await assertMissingAuthority(
        teleporteos.delreceipts(lastId, { from: sender1 })
        )
    })
    it('with oracle auth should fail with auth error dr3', async () => {
      await assertMissingAuthority(
          teleporteos.delreceipts(lastId, { from: oracle1 })
      )
    })
    it('should fail with delete to last id dr4', async () => {
      await assertEOSErrorIncludesMessage(
        teleporteos.delreceipts(lastId + 1, { from: teleporteos.account }), 
        "Id dos not exists"
      )
    })
    it('should succeed with delete to forelast id dr5', async () => {
      await teleporteos.delreceipts(lastId, { from: teleporteos.account })
      const receipts = await teleporteos.receiptsTable()
      chai.expect(receipts.rows.length).equal(2, 'Wrong amount of receipts are deleted')
      chai.expect(receipts.rows[0].id).equal(1, 'Wrong deletion')
      chai.expect(receipts.rows[1].id).equal(5, 'Wrong deletion')
    })
    it('should fail with deleted but completed teleport dr7', async () => {
      await assertEOSErrorIncludesMessage(
        teleporteos.received(
          oracle3.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          1,
          true,
          { from: oracle3 }
        ), 
        "This teleport is already completed"
      )
    })
    it('should succeed dr8', async () => {
      await teleporteos.received(
        oracle3.name,
        sender1.name,
        '1111111111111111111111111111111111111111111111111111111111111111',
        `123.0000 ${token_symbol}`,
        2,
        2,
        true,
        { from: oracle3 }
      )
    })
    it('should succeed by deleting all remaining succeed teleports dr9', async () => {
      initialReceipts = await teleporteos.receiptsTable()
      lastId = Number(initialReceipts.rows[initialReceipts.rows.length - 1].id)
      await teleporteos.delreceipts(lastId, { from: teleporteos.account })
      const receipts = await teleporteos.receiptsTable()
      chai.expect(receipts.rows.length).equal(2, 'Not all deleted')
      chai.expect(receipts.rows[0].id).equal(1, 'Wrong deletion')
      chai.expect(receipts.rows[1].id).equal(6, 'Wrong deletion')
    })
  })
})

async function seedAccounts() {
  teleporteos = await ContractDeployer.deployWithName<Teleporteos>(
    'contracts/teleport/teleporteos',
    'teleporteos'
  )

  alienworldsToken = await ContractDeployer.deployWithName<EosioToken>(
    'contracts/eosio.token/eosio.token',
    token_contract
  )

  sender1 = await AccountManager.createAccount('sender1')
  sender2 = await AccountManager.createAccount('sender2')
  oracle1 = await AccountManager.createAccount('oracle1')
  oracle2 = await AccountManager.createAccount('oracle2')
  oracle3 = await AccountManager.createAccount('oracle3')
  oracle4 = await AccountManager.createAccount('oracle4')

  await issueTokens()
  await updateAuths()
}

async function updateAuths() {
  await UpdateAuth.execUpdateAuth(
    [{ actor: teleporteos.account.name, permission: 'owner' }],
    teleporteos.account.name,
    'active',
    'owner',
    UpdateAuth.AuthorityToSet.explicitAuthorities(
      1,
      [
        {
          permission: {
            actor: teleporteos.account.name,
            permission: 'eosio.code',
          },
          weight: 1,
        },
      ],
      [{ key: teleporteos.account.publicKey!, weight: 1 }]
    )
  )

  // await UpdateAuth.execLinkAuth(
  //   landholders.account.active,
  //   landholders.account.name,
  //   eosioToken.account.name,
  //   'transfer',
  //   'distribpay'
  // )
}

async function issueTokens() {
  try {
    await alienworldsToken.create(
      alienworldsToken.account.name,
      `1000000000.0000 ${token_symbol}`,
      { from: alienworldsToken.account }
    )

    await alienworldsToken.issue(
      alienworldsToken.account.name,
      `10000000.0000 ${token_symbol}`,
      'initial deposit',
      { from: alienworldsToken.account }
    )
  } catch (e) {
    if ((e as { json: {error: {what: string } } }).json.error.what != 'eosio_assert_message assertion failure') {
      throw e
    }
  }

  await alienworldsToken.transfer(
    alienworldsToken.account.name,
    sender1.name,
    `1000000.0000 ${token_symbol}`,
    'inital balance',
    { from: alienworldsToken.account }
  )

  await alienworldsToken.transfer(
    alienworldsToken.account.name,
    teleporteos.account.name,
    `1000000.0000 ${token_symbol}`,
    'inital balance',
    { from: alienworldsToken.account }
  )
}

function amountToAsset(amount: bigint, symbol_name: string, precision: number){
  let s = amount.toString().padStart(precision, '0')
  let p = s.length - precision
  let int = s.substring(0, p)
  return `${int? int : '0'}${'.'}${s.substring(p)} ${symbol_name}` 
}

function stringToAsset(asset_str: string){
  let s = asset_str.indexOf('.')
  let e = asset_str.indexOf(' ', s)
  let precision = e - s
  let name = asset_str.substring(e + 1).trim()
  let amount =  BigInt(asset_str.substring(0, s) + asset_str.substring(s + 1, e))
  return {amount, symbol: {precision, name}}
}

function calcFee(amount: bigint, fixfeeAmount: bigint, varfee: number){
  return BigInt(Math.floor(Number(amount) * varfee)) + fixfeeAmount
}