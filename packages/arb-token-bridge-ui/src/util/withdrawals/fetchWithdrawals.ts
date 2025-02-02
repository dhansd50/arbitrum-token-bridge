import { Provider } from '@ethersproject/providers'

import { fetchETHWithdrawalsFromEventLogs } from './fetchETHWithdrawalsFromEventLogs'

import {
  FetchWithdrawalsFromSubgraphResult,
  fetchWithdrawalsFromSubgraph
} from './fetchWithdrawalsFromSubgraph'
import { fetchLatestSubgraphBlockNumber } from '../SubgraphUtils'

import { Withdrawal } from '../../hooks/useTransactionHistory'
import { attachTimestampToTokenWithdrawal } from './helpers'
import { WithdrawalInitiated } from '../../hooks/arbTokenBridge.types'
import { fetchTokenWithdrawalsFromEventLogsSequentially } from './fetchTokenWithdrawalsFromEventLogsSequentially'
import { backOff, wait } from '../ExponentialBackoffUtils'

export type FetchWithdrawalsParams = {
  sender?: string
  receiver?: string
  fromBlock?: number
  toBlock?: number
  l1Provider: Provider
  l2Provider: Provider
  pageNumber?: number
  pageSize?: number
  searchString?: string
}

export async function fetchWithdrawals({
  sender,
  receiver,
  l1Provider,
  l2Provider,
  pageNumber = 0,
  pageSize = 10,
  searchString,
  fromBlock,
  toBlock
}: FetchWithdrawalsParams): Promise<Withdrawal[]> {
  if (typeof sender === 'undefined' && typeof receiver === 'undefined') {
    return []
  }

  const l1ChainID = (await l1Provider.getNetwork()).chainId
  const l2ChainID = (await l2Provider.getNetwork()).chainId

  if (!fromBlock) {
    fromBlock = 0
  }

  if (!toBlock) {
    // if toBlock hasn't been provided by the user

    // fetch the latest L2 block number thorough subgraph
    const latestSubgraphBlockNumber = await fetchLatestSubgraphBlockNumber(
      l2ChainID
    )
    toBlock = latestSubgraphBlockNumber
  }

  let withdrawalsFromSubgraph: FetchWithdrawalsFromSubgraphResult[] = []
  try {
    withdrawalsFromSubgraph = (
      await fetchWithdrawalsFromSubgraph({
        sender,
        receiver,
        fromBlock,
        toBlock,
        l2ChainId: l2ChainID,
        pageNumber,
        pageSize,
        searchString
      })
    ).map(tx => {
      return {
        ...tx,
        direction: 'withdrawal',
        source: 'subgraph',
        parentChainId: l1ChainID,
        childChainId: l2ChainID
      }
    })
  } catch (error) {
    console.log('Error fetching withdrawals from subgraph', error)
  }

  const ethWithdrawalsFromEventLogs = await backOff(() =>
    fetchETHWithdrawalsFromEventLogs({
      receiver,
      // not sure why eslint is treating "toBlock" as "number | undefined" here
      // even though typescript recognizes it as "number"
      fromBlock: toBlock ?? 0 + 1,
      toBlock: 'latest',
      l2Provider: l2Provider
    })
  )

  await wait(2_000)

  const tokenWithdrawalsFromEventLogs =
    await fetchTokenWithdrawalsFromEventLogsSequentially({
      sender,
      receiver,
      fromBlock: toBlock + 1,
      toBlock: 'latest',
      provider: l2Provider
    })

  const mappedEthWithdrawalsFromEventLogs: Withdrawal[] =
    ethWithdrawalsFromEventLogs.map(tx => {
      return {
        ...tx,
        direction: 'withdrawal',
        source: 'event_logs',
        parentChainId: l1ChainID,
        childChainId: l2ChainID
      }
    })

  const mappedTokenWithdrawalsFromEventLogs: WithdrawalInitiated[] =
    tokenWithdrawalsFromEventLogs.map(tx => {
      return {
        ...tx,
        direction: 'withdrawal',
        source: 'event_logs',
        parentChainId: l1ChainID,
        childChainId: l2ChainID
      }
    })

  // we need timestamps to sort token withdrawals along ETH withdrawals
  const tokenWithdrawalsFromEventLogsWithTimestamp: Withdrawal[] =
    await Promise.all(
      mappedTokenWithdrawalsFromEventLogs.map(withdrawal =>
        attachTimestampToTokenWithdrawal({ withdrawal, l2Provider })
      )
    )

  return [
    ...mappedEthWithdrawalsFromEventLogs,
    ...tokenWithdrawalsFromEventLogsWithTimestamp,
    ...withdrawalsFromSubgraph
  ]
}
